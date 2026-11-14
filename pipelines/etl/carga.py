"""ETL de produção: CNES + base territorial + IBGE -> PostGIS + vector tiles.

Uso: pipelines/run.sh etl/carga.py [AAAAMM]      (DATABASE_URL opcional)

Fluxo: baixar -> extrair -> transformar (DuckDB filtra MG; pandas só vê o recorte)
       -> relatório + verificações -> carga numa única transação -> tiles (tippecanoe).
Regras de negócio: docs/adr/0002, 0003, 0004 e CLAUDE.md (raiz).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

# `python -I` não põe o diretório do script no sys.path; precisamos de `etl.*`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import duckdb  # noqa: E402
import geopandas as gpd  # noqa: E402
import pandas as pd  # noqa: E402
import psycopg  # noqa: E402
import shapely  # noqa: E402

from etl import baixar  # noqa: E402
from etl.classificacao import classificar_tipo_unidade, slugs_validos, tipo_conhecido  # noqa: E402
from etl.transformacoes import (  # noqa: E402
    coord_ok_lote, coord_valida, densidade, dia_semana, nome_macro, nome_regiao, natureza, numero_br,
    para_multipolygon, parse_data_br, parse_hora, por_10mil,
)

COMP = sys.argv[1] if len(sys.argv) > 1 else "202609"
DATABASE_URL = os.environ.get("DATABASE_URL", "postgres://webgissus:webgissus_dev@127.0.0.1:5432/webgissus")
RAW = Path("data/raw")
INTERIM = Path("data/interim/etl") / COMP
TILES = Path("data/processed/tiles")
SCHEMA = Path("infra/db/001_schema.sql")
DOC_QUALIDADE = Path("docs/qualidade") / f"carga-{COMP}.md"

CNES_ZIP = RAW / "cnes" / f"BASE_DE_DADOS_CNES_{COMP}.ZIP"
TERR_ZIP = next((RAW / "territorio").glob("*base_territorial*.zip"))
MALHA_MUN_ZIP = RAW / "ibge" / "MG_Municipios_2024.zip"
SIDRA_JSON = RAW / "ibge" / baixar.SIDRA_ARQ
SETORES_ZIP = RAW / "ibge" / "MG_setores_CD2022.zip"
BASICO_ZIP = RAW / "ibge" / "Agregados_por_setores_basico_BR_20260520.zip"

CNES_TABELAS = ["tbEstabelecimento", "tbEstabHorarioAtend", "rlEstabServClass", "rlEstabAtendPrestConv",
                "tbServicoEspecializado", "tbClassificacaoServico", "tbAtendimentoPrestado",
                "tbTurnoAtendimento", "tbTipoUnidade"]
TERR_TABELAS = ["tb_municip.csv", "tb_regsaud.csv", "tb_macsaud.csv",
                "rl_municip_regsaud.csv", "rl_municip_macsaud.csv"]

# Verificações que derrubam a carga (ADR 0002 e pedido do autor).
ESPERADO = {"municipios": 853, "regioes": 89, "macros": 16}
UNIVERSO_MINIMO = 10_000


class CargaInvalida(Exception):
    pass


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


# ---------------------------------------------------------------- extração
def extrair() -> None:
    INTERIM.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(CNES_ZIP) as z:
        for t in CNES_TABELAS:
            nome = f"{t}{COMP}.csv"
            if not (INTERIM / nome).exists():
                log(f"extraindo {nome}")
                z.extract(nome, INTERIM)
    with zipfile.ZipFile(TERR_ZIP) as z:
        for nome in TERR_TABELAS:
            if not (INTERIM / nome).exists():
                z.extract(nome, INTERIM)
    if not (INTERIM / "Agregados_por_setores_basico_BR.csv").exists():
        # o CSV do IBGE é latin-1/cp1252 (DuckDB rejeita bytes 0x80-0x9F): regrava em UTF-8
        with zipfile.ZipFile(BASICO_ZIP) as z, z.open("Agregados_por_setores_basico_BR.csv") as src, \
                (INTERIM / "Agregados_por_setores_basico_BR.csv").open("w", encoding="utf-8", newline="") as dst:
            for linha in src:
                dst.write(linha.decode("cp1252", errors="replace"))


def cnes(t: str) -> str:
    return (f"read_csv('{INTERIM}/{t}{COMP}.csv', delim=';', header=true, all_varchar=true, "
            "encoding='latin-1')")


def terr(nome: str) -> str:
    # UTF-8; o delimitador varia por arquivo (auto-detecção do DuckDB)
    return f"read_csv('{INTERIM}/{nome}', header=true, all_varchar=true)"


# ---------------------------------------------------------------- territórios
def carregar_territorio(con: duckdb.DuckDBPyConnection) -> dict:
    """Municípios (com geom 4326), regiões e macros (dissolve da malha municipal)."""
    malha = gpd.read_file(f"zip://{MALHA_MUN_ZIP}").to_crs(4326)
    malha = malha[["CD_MUN", "NM_MUN", "AREA_KM2", "geometry"]].rename(
        columns={"CD_MUN": "cd", "NM_MUN": "nome", "AREA_KM2": "area_malha_km2"})

    mun = con.execute(f"""
      SELECT m.CO_MUNICIP AS cd6, m.CO_MUNICDV AS cd,
             r.CO_REGSAUD AS cd_regiao, k.CO_MACSAUD AS cd_macro
      FROM {terr('tb_municip.csv')} m
      LEFT JOIN {terr('rl_municip_regsaud.csv')} r USING (CO_MUNICIP)
      LEFT JOIN {terr('rl_municip_macsaud.csv')} k USING (CO_MUNICIP)
      WHERE m.UF='MG' AND m.CO_STATUS='ATIVO'""").df()
    dup = mun[mun.duplicated("cd6", keep=False)]
    if len(dup):
        raise CargaInvalida(f"municípios com mais de uma região/macro na base territorial: {dup.cd6.tolist()[:10]}")
    sem_malha = sorted(set(mun.cd) - set(malha.cd))
    if sem_malha:
        raise CargaInvalida(f"municípios da base territorial sem par na malha IBGE: {sem_malha[:10]}")
    mun = mun.merge(malha, on="cd", how="inner")
    mun = gpd.GeoDataFrame(mun, geometry="geometry", crs=4326)

    # Censo 2022 (SIDRA 4714): v93 = população residente, v6318 = área (km²)
    dados = json.loads(SIDRA_JSON.read_text(encoding="utf-8"))[1:]
    pop = {d["D1C"]: numero_br(d["V"]) for d in dados if d["D2C"] == "93"}
    area = {d["D1C"]: numero_br(d["V"]) for d in dados if d["D2C"] == "6318"}
    mun["populacao"] = [None if pop.get(c) is None else int(pop[c]) for c in mun.cd]
    mun["populacao"] = mun["populacao"].astype("Int64")
    mun["area_km2"] = [area.get(c) if area.get(c) is not None else a
                       for c, a in zip(mun.cd, mun.area_malha_km2)]
    mun["densidade"] = [densidade(None if pd.isna(p) else int(p), a)
                        for p, a in zip(mun.populacao, mun.area_km2)]

    nomes_reg = con.execute(f"SELECT CO_REGSAUD cd, DS_NOME nome FROM {terr('tb_regsaud.csv')}").df()
    nomes_mac = con.execute(f"SELECT CO_MACSAUD cd, DS_NOME nome FROM {terr('tb_macsaud.csv')}").df()

    def dissolver(col: str, nomes: pd.DataFrame, normaliza) -> gpd.GeoDataFrame:
        g = mun.dissolve(by=col, as_index=False, aggfunc={"populacao": "sum"})[[col, "populacao", "geometry"]]
        g = g.rename(columns={col: "cd"}).merge(nomes, on="cd", how="left")
        g["nome"] = g["nome"].map(lambda s: normaliza(s) if isinstance(s, str) else s)
        g["geometry"] = [para_multipolygon(x) for x in g.geometry]
        return g

    regioes = dissolver("cd_regiao", nomes_reg, nome_regiao)
    regioes = regioes.merge(mun[["cd_regiao", "cd_macro"]].drop_duplicates().rename(columns={"cd_regiao": "cd"}),
                            on="cd", how="left")
    macros = dissolver("cd_macro", nomes_mac, nome_macro)
    mun["geometry"] = [para_multipolygon(x) for x in mun.geometry]
    return {"municipios": mun, "regioes": regioes, "macros": macros}


# ---------------------------------------------------------------- estabelecimentos
def carregar_estabelecimentos(con: duckdb.DuckDBPyConnection, terr_: dict) -> dict:
    mun = terr_["municipios"]
    mapa6 = dict(zip(mun.cd6, mun.cd))
    geoms = dict(zip(mun.cd, mun.geometry))

    # Candidatos: localizados em MG (CO_UNIDADE começa com 31), ativos, com convênio SUS 01.
    cand = con.execute(f"""
      SELECT e.CO_UNIDADE AS co_unidade, lpad(e.CO_CNES, 7, '0') AS cnes,
             NULLIF(trim(e.NO_FANTASIA),'') AS nome, NULLIF(trim(e.NO_RAZAO_SOCIAL),'') AS razao_social,
             TRY_CAST(e.TP_UNIDADE AS INT) AS tp_unidade,
             substr(e.CO_UNIDADE,1,6) AS cd6,
             NULLIF(trim(e.NO_LOGRADOURO),'') AS logradouro, NULLIF(trim(e.NU_ENDERECO),'') AS numero,
             NULLIF(trim(e.NO_COMPLEMENTO),'') AS complemento, NULLIF(trim(e.NO_BAIRRO),'') AS bairro,
             NULLIF(trim(e.CO_CEP),'') AS cep, NULLIF(trim(e.NU_TELEFONE),'') AS telefone,
             NULLIF(trim(e.NO_EMAIL),'') AS email, e.CO_NATUREZA_JUR AS co_natureza,
             e.TP_ESTAB_SEMPRE_ABERTO = 'S' AS sempre_aberto,
             t.DS_TURNO_ATENDIMENTO AS turno,
             "TO_CHAR(DT_ATUALIZACAO,'DD/MM/YYYY')" AS dt_atualizacao,
             TRY_CAST(replace(e.NU_LONGITUDE, ',', '.') AS DOUBLE) AS lon,
             TRY_CAST(replace(e.NU_LATITUDE, ',', '.') AS DOUBLE) AS lat
      FROM {cnes('tbEstabelecimento')} e
      LEFT JOIN {cnes('tbTurnoAtendimento')} t ON t.CO_TURNO_ATENDIMENTO = e.CO_TURNO_ATENDIMENTO
      WHERE substr(e.CO_UNIDADE,1,2) = '31'
        AND NULLIF(trim(e.CO_MOTIVO_DESAB),'') IS NULL
        AND e.CO_UNIDADE IN (SELECT CO_UNIDADE FROM {cnes('rlEstabAtendPrestConv')} WHERE CO_CONVENIO = '01')
    """).df()
    sus_ativos_mg = len(cand)

    tipos_desc = con.execute(f"SELECT TRY_CAST(CO_TIPO_UNIDADE AS INT) tp, DS_TIPO_UNIDADE ds FROM {cnes('tbTipoUnidade')}").df()
    desc = dict(zip(tipos_desc.tp, tipos_desc.ds))

    cand["categoria"] = [classificar_tipo_unidade(int(t)) if pd.notna(t) else None for t in cand.tp_unidade]
    desconhecidos = cand[[pd.isna(t) or not tipo_conhecido(int(t)) for t in cand.tp_unidade]]
    desconhecidos_cont = {
        (str(int(k)) if pd.notna(k) else "sem_tipo"): {"n": int(v), "descricao": desc.get(k)}
        for k, v in desconhecidos.groupby("tp_unidade", dropna=False).size().items()}
    fora_categoria = cand[cand.categoria.isna() & ~cand.index.isin(desconhecidos.index)]
    excluidos_cont = {str(int(k)): {"n": int(v), "descricao": desc.get(k)}
                      for k, v in fora_categoria.groupby("tp_unidade").size().items()}

    est = cand[cand.categoria.notna()].copy()
    # município de localização: 6 primeiros dígitos de CO_UNIDADE -> 7 dígitos via tb_municip
    est["cd_municipio"] = est.cd6.map(mapa6)
    sem_mun = est[est.cd_municipio.isna()]
    est = est[est.cd_municipio.notna()].copy()

    # nome é NOT NULL: usa a razão social quando NO_FANTASIA estiver vazio
    sem_fantasia = int(est.nome.isna().sum())
    est["nome"] = est.nome.fillna(est.razao_social)
    sem_nome = est[est.nome.isna()]
    est = est[est.nome.notna()].copy()

    est["natureza"] = [natureza(x) for x in est.co_natureza]
    est["cep"] = [c if isinstance(c, str) and len(c) == 8 and c.isdigit() else None for c in est.cep]
    est["atualizado_em"] = [parse_data_br(x) for x in est.dt_atualizacao]
    est["sempre_aberto"] = est.sempre_aberto.fillna(False).astype(bool)

    # coordenada: sem coordenada válida não há ponto (geom é NOT NULL): fica de fora e é reportado
    tem_coord = [coord_valida(x, y) for x, y in zip(est.lon, est.lat)]
    sem_coord = est[[not t for t in tem_coord]]
    est = est[tem_coord].copy()
    est["coord_ok"] = coord_ok_lote(est.lon, est.lat, [geoms[c] for c in est.cd_municipio])

    uni = est.co_unidade.tolist()
    con.register("universo", pd.DataFrame({"co_unidade": uni}))

    # --- horários
    h = con.execute(f"""
      SELECT CO_UNIDADE co_unidade, CO_DIA_SEMANA dia, HR_INICIO_ATENDIMENTO ini, HR_FIM_ATENDIMENTO fim
      FROM {cnes('tbEstabHorarioAtend')} WHERE CO_UNIDADE IN (SELECT co_unidade FROM universo)""").df()
    h["dia_n"] = [dia_semana(d) for d in h.dia]
    h["abre"] = [parse_hora(x) for x in h.ini]
    h["fecha"] = [parse_hora(x) for x in h.fim]
    h_dia_inv = int(h.dia_n.isna().sum())
    h_hora_inv = int((h.dia_n.notna() & (h.abre.isna() | h.fecha.isna())).sum())
    exemplos_inv = (h[h.abre.isna() | h.fecha.isna()].assign(par=lambda d: d.ini.astype(str) + " -> " + d.fim.astype(str))
                    .par.value_counts().head(10).to_dict())
    hv = h[h.dia_n.notna() & h.abre.notna() & h.fecha.notna()].copy()
    antes = len(hv)
    # PK (cnes, dia, abre): se houver duas linhas com a mesma abertura, fica a de maior fechamento
    hv = hv.sort_values("fecha").drop_duplicates(["co_unidade", "dia_n", "abre"], keep="last")
    h_dup = antes - len(hv)
    hv = hv.merge(est[["co_unidade", "cnes"]], on="co_unidade")
    h_virada = int((hv.fecha < hv.abre).sum())
    h_iguais = int((hv.fecha == hv.abre).sum())

    # --- serviços especializados
    sv = con.execute(f"""
      SELECT r.CO_UNIDADE co_unidade, r.CO_SERVICO cd_servico, r.CO_CLASSIFICACAO cd_classificacao,
             any_value(s.DS_SERVICO_ESPECIALIZADO) servico, any_value(c.DS_CLASSIFICACAO_SERVICO) classificacao,
             bool_or(r.CO_AMBULATORIAL_SUS = '1' OR r.CO_HOSPITALAR_SUS = '1') sus
      FROM {cnes('rlEstabServClass')} r
      LEFT JOIN {cnes('tbServicoEspecializado')} s ON s.CO_SERVICO_ESPECIALIZADO = r.CO_SERVICO
      LEFT JOIN {cnes('tbClassificacaoServico')} c
             ON c.CO_CLASSIFICACAO_SERVICO = r.CO_CLASSIFICACAO AND c.CO_SERVICO_ESPECIALIZADO = r.CO_SERVICO
      WHERE r.CO_UNIDADE IN (SELECT co_unidade FROM universo)
      GROUP BY 1, 2, 3""").df()
    sv_sem_desc = int(sv.servico.isna().sum())
    sv = sv[sv.servico.notna()].merge(est[["co_unidade", "cnes"]], on="co_unidade")

    # --- atendimentos prestados (sus = há convênio 01 para aquele atendimento)
    at = con.execute(f"""
      SELECT r.CO_UNIDADE co_unidade, a.DS_ATENDIMENTO_PRESTADO atendimento, bool_or(r.CO_CONVENIO = '01') sus
      FROM {cnes('rlEstabAtendPrestConv')} r
      JOIN {cnes('tbAtendimentoPrestado')} a ON a.CO_ATENDIMENTO_PRESTADO = r.CO_ATENDIMENTO_PRESTADO
      WHERE r.CO_UNIDADE IN (SELECT co_unidade FROM universo)
      GROUP BY 1, 2""").df()
    at = at.merge(est[["co_unidade", "cnes"]], on="co_unidade")

    com_horario = set(hv.co_unidade)
    sem_horario = est[~est.co_unidade.isin(com_horario)]
    por_cat = est.groupby("categoria").size().sort_values(ascending=False)
    fora = est[~est.coord_ok]

    relatorio = {
        "candidatos_ativos_sus_mg": sus_ativos_mg,
        "universo": len(est),
        "por_categoria": {k: int(v) for k, v in por_cat.items()},
        "por_natureza": {k: int(v) for k, v in est.groupby("natureza").size().items()},
        "coord_ok_falso": {
            "n": len(fora), "pct": round(100 * len(fora) / max(len(est), 1), 2),
            "por_categoria": {k: int(v) for k, v in fora.groupby("categoria").size().items()},
        },
        "excluidos": {
            "tipos_desconhecidos": desconhecidos_cont,
            "tipos_fora_do_mapa_por_decisao": excluidos_cont,
            "sem_municipio_na_base_territorial": len(sem_mun),
            "sem_nome_fantasia_nem_razao": len(sem_nome),
            "sem_coordenada": len(sem_coord),
        },
        "nome_fantasia_vazio_usou_razao_social": sem_fantasia,
        "horarios": {
            "linhas_carregadas": len(hv),
            "estabelecimentos_com_horario": len(com_horario),
            "sempre_aberto": int(est.sempre_aberto.sum()),
            "sem_linhas_de_horario": len(sem_horario),
            "sem_horario_e_sem_24h": int((~est.co_unidade.isin(com_horario) & ~est.sempre_aberto).sum()),
            "sem_horario_e_sem_24h_por_categoria": {
                k: int(v) for k, v in sem_horario[~sem_horario.sempre_aberto].groupby("categoria").size().items()},
            "linhas_descartadas_dia_invalido": h_dia_inv,
            "linhas_descartadas_hora_invalida_ou_truncada": h_hora_inv,
            "exemplos_hora_descartada": exemplos_inv,
            "linhas_duplicadas_na_chave_removidas": h_dup,
            "faixas_que_viram_a_meia_noite": h_virada,
            "faixas_abre_igual_fecha": h_iguais,
        },
        "servicos": {"linhas": len(sv), "descartadas_sem_descricao": sv_sem_desc,
                     "estabelecimentos_com_servico": int(sv.co_unidade.nunique())},
        "atendimentos": {"linhas": len(at), "estabelecimentos": int(at.co_unidade.nunique())},
    }
    return {"est": est, "horarios": hv, "servicos": sv, "atendimentos": at, "relatorio": relatorio}


# ---------------------------------------------------------------- setores
def preparar_setores(mun: gpd.GeoDataFrame) -> dict:
    """Malha de setores 2022 de MG + população (agregados 'básico', v0001 = total de pessoas)."""
    g = gpd.read_file(f"zip://{SETORES_ZIP}", columns=["CD_SETOR", "CD_MUN", "AREA_KM2"]).to_crs(4326)
    g = g.rename(columns={"CD_SETOR": "cd_setor", "CD_MUN": "cd_mun", "AREA_KM2": "area_km2"})
    pop = duckdb.connect().execute(f"""
      SELECT CD_SETOR cd_setor, v0001 FROM read_csv('{INTERIM}/Agregados_por_setores_basico_BR.csv',
        delim=';', header=true, all_varchar=true) WHERE CD_UF = '31'""").df()
    pop["populacao"] = [numero_br(x) for x in pop.v0001]
    g = g.merge(pop[["cd_setor", "populacao"]], on="cd_setor", how="left")
    sem_pop = int(g.populacao.isna().sum())
    g["populacao"] = g.populacao.astype("Int64")
    g["densidade"] = [round(d, 2) if (d := densidade(None if pd.isna(p) else int(p), a)) is not None else None
                      for p, a in zip(g.populacao, g.area_km2)]
    g["area_km2"] = g.area_km2.round(4)
    arq = INTERIM / "setores.geojsonseq"
    _escrever_geojsonseq(g, arq)
    mun_cd = set(mun.cd)
    return {
        "arquivo": str(arq),
        "carregados": len(g),
        "sem_populacao": sem_pop,
        "cd_mun_fora_da_lista_de_municipios": int((~g.cd_mun.isin(mun_cd)).sum()),
        "populacao_total_setores": int(g.populacao.sum()),
        "setores_sem_par_no_agregado": sem_pop,
    }


def _escrever_geojsonseq(gdf: gpd.GeoDataFrame, arq: Path) -> None:
    """GeoJSONSeq com propriedades limpas (NaN/NA -> null) para o tippecanoe."""
    arq.parent.mkdir(parents=True, exist_ok=True)
    cols = [c for c in gdf.columns if c != "geometry"]
    with arq.open("w", encoding="utf-8") as f:
        for geom, *vals in zip(gdf.geometry, *[gdf[c] for c in cols]):
            props = {c: (None if pd.isna(v) else (v.item() if hasattr(v, "item") else v)) for c, v in zip(cols, vals)}
            f.write(json.dumps({"type": "Feature", "properties": props,
                                "geometry": json.loads(shapely.to_geojson(shapely.transform(geom, lambda c: c.round(6))))},
                               ensure_ascii=False) + "\n")


# ---------------------------------------------------------------- relatório
def montar_agregados(terr_: dict, est: pd.DataFrame) -> None:
    """Contagens por município/região/macro (estabelecimentos do universo) para tiles e relatório."""
    mun = terr_["municipios"]
    slugs = sorted(slugs_validos())
    cont = est.groupby(["cd_municipio", "categoria"]).size().unstack(fill_value=0).reindex(columns=slugs, fill_value=0)
    cont = cont.reindex(mun.cd, fill_value=0)
    for s in slugs:
        mun[s] = cont[s].to_numpy()
    mun["total"] = cont.sum(axis=1).to_numpy()
    mun["estab_por_10mil"] = [por_10mil(int(t), None if pd.isna(p) else int(p)) for t, p in zip(mun.total, mun.populacao)]
    for chave, col in (("regioes", "cd_regiao"), ("macros", "cd_macro")):
        agg = mun.groupby(col)[["total"]].sum().rename_axis("cd")
        g = terr_[chave].merge(agg, on="cd", how="left")
        g["estab_por_10mil"] = [por_10mil(int(t), None if pd.isna(p) else int(p)) for t, p in zip(g.total, g.populacao)]
        terr_[chave] = g


def verificar(contagens: dict, universo: int) -> list[str]:
    erros = []
    for k, esperado in ESPERADO.items():
        if contagens[k] != esperado:
            erros.append(f"{k}: {contagens[k]} (esperado {esperado})")
    if universo < UNIVERSO_MINIMO:
        erros.append(f"universo: {universo} (< {UNIVERSO_MINIMO})")
    return erros


ROTULOS_HORARIO = {
    "estabelecimentos_com_horario": "estabelecimentos com horário",
    "sem_linhas_de_horario": "sem linhas de horário",
    "sem_horario_e_sem_24h": "sem horário e sem 24h",
    "linhas_descartadas_dia_invalido": "linhas descartadas: dia inválido",
    "linhas_descartadas_hora_invalida_ou_truncada": "linhas descartadas: hora inválida ou truncada",
}


def escrever_md(rel: dict, erros: list[str]) -> None:
    def tab(d: dict, c1: str, c2: str = "n") -> list[str]:
        return [f"| {c1} | {c2} |", "|---|---:|"] + [f"| {k} | {v:,} |" for k, v in d.items()]
    r = rel
    L = [f"# Relatório de qualidade da carga · competência {COMP[:4]}-{COMP[4:]}\n",
         f"Gerado por `pipelines/etl/carga.py` em {r['executada_em']}. Status: **{'FALHOU' if erros else 'ok'}**.\n"]
    if erros:
        L += ["Verificações que falharam (carga revertida):", *[f"- {e}" for e in erros], ""]
    t = r["territorio"]
    L += ["## Territórios\n", "| Item | Valor |", "|---|---:|",
          f"| Municípios | {t['municipios']} |", f"| Regiões de saúde | {t['regioes']} |",
          f"| Macrorregiões | {t['macros']} |",
          f"| Municípios sem população (Censo 2022) | {len(t['municipios_sem_populacao'])} |",
          f"| População total (soma dos municípios) | {t['populacao_total']:,} |\n"]
    if t["municipios_sem_populacao"]:
        L += ["Municípios sem população: " + ", ".join(t["municipios_sem_populacao"]) + "\n"]
    L += ["## Universo (ativo + SUS + categoria do mapa)\n",
          f"- Candidatos (MG, ativos, convênio SUS 01): {r['candidatos_ativos_sus_mg']:,}",
          f"- **Universo carregado: {r['universo']:,}**\n", "### Por categoria\n", *tab(r["por_categoria"], "Categoria"),
          "", "### Por natureza\n", *tab(r["por_natureza"], "Natureza"), "",
          "### Coordenada fora do próprio município (`coord_ok` = falso)\n",
          f"{r['coord_ok_falso']['n']:,} ({r['coord_ok_falso']['pct']}% do universo). Ficam no banco, fora de \"perto de mim\".\n",
          *tab(r["coord_ok_falso"]["por_categoria"], "Categoria"), ""]
    ex = r["excluidos"]
    L += ["### Fora do universo\n",
          f"- Sem coordenada válida (geom é NOT NULL): {ex['sem_coordenada']}",
          f"- Município de CO_UNIDADE ausente da base territorial: {ex['sem_municipio_na_base_territorial']}",
          f"- Sem NO_FANTASIA e sem razão social: {ex['sem_nome_fantasia_nem_razao']}",
          f"- NO_FANTASIA vazio (usou razão social): {r['nome_fantasia_vazio_usou_razao_social']}\n",
          "**Códigos TP_UNIDADE desconhecidos (fora do mapa até decisão do autor):**\n"]
    if ex["tipos_desconhecidos"]:
        L += ["| TP_UNIDADE | n | descrição CNES |", "|---|---:|---|"] + [
            f"| {k} | {v['n']} | {v['descricao']} |" for k, v in ex["tipos_desconhecidos"].items()]
    else:
        L += ["Nenhum."]
    L += ["", "Tipos fora do mapa por decisão (ADR 0003) que têm SUS ativo:\n", "| TP_UNIDADE | n | descrição |", "|---|---:|---|"] + [
        f"| {k} | {v['n']} | {v['descricao']} |" for k, v in ex["tipos_fora_do_mapa_por_decisao"].items()]
    h = r["horarios"]
    L += ["", "## Horários\n", "| Item | Valor |", "|---|---:|"] + [
        f"| {ROTULOS_HORARIO.get(k, k.replace('_', ' '))} | {v:,} |" for k, v in h.items() if isinstance(v, int)]
    L += ["", "Sem horário e sem 24h, por categoria:\n", *tab(h["sem_horario_e_sem_24h_por_categoria"], "Categoria"),
          "", "Horários descartados por formato ambíguo/truncado (mais frequentes):\n", "| inicio -> fim | n |", "|---|---:|"] + [
        f"| `{k}` | {v} |" for k, v in h["exemplos_hora_descartada"].items()]
    s, a = r["servicos"], r["atendimentos"]
    L += ["", "## Serviços e atendimentos\n",
          f"- Serviços: {s['linhas']:,} linhas em {s['estabelecimentos_com_servico']:,} estabelecimentos "
          f"(descartadas sem descrição: {s['descartadas_sem_descricao']})",
          f"- Atendimentos: {a['linhas']:,} linhas em {a['estabelecimentos']:,} estabelecimentos\n"]
    st = r["setores"]
    L += ["## Setores censitários 2022 (só nos tiles)\n", "| Item | Valor |", "|---|---:|",
          f"| Setores na malha | {st['carregados']:,} |", f"| Sem população no agregado | {st['sem_populacao']:,} |",
          f"| CD_MUN fora da lista de municípios | {st['cd_mun_fora_da_lista_de_municipios']} |",
          f"| População somada dos setores | {st['populacao_total_setores']:,} |"]
    DOC_QUALIDADE.parent.mkdir(parents=True, exist_ok=True)
    DOC_QUALIDADE.write_text("\n".join(L) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- banco
def hexgeom(g) -> str:
    return shapely.to_wkb(shapely.set_srid(g, 4326), hex=True, include_srid=True)


def ponto(lon: float, lat: float) -> str:
    return hexgeom(shapely.Point(lon, lat))


def nn(v):
    """pandas NA/NaN -> None (para COPY)."""
    return None if v is None or (not isinstance(v, (str, bool)) and pd.isna(v)) else v


def copiar(cur: psycopg.Cursor, tabela: str, cols: list[str], linhas) -> int:
    n = 0
    with cur.copy(f"COPY {tabela} ({', '.join(cols)}) FROM STDIN") as cp:
        for row in linhas:
            cp.write_row(row)
            n += 1
    return n


def carregar_banco(terr_: dict, dados: dict, fontes: dict, relatorio: dict) -> list[str]:
    """Tudo numa transação. Devolve a lista de erros de verificação (vazia = commit)."""
    mun, reg, mac = terr_["municipios"], terr_["regioes"], terr_["macros"]
    est, hv, sv, at = dados["est"], dados["horarios"], dados["servicos"], dados["atendimentos"]
    with psycopg.connect(DATABASE_URL) as conn:  # sem commit explícito = rollback ao sair com erro
        cur = conn.cursor()
        cur.execute(SCHEMA.read_text(encoding="utf-8"))
        cur.execute("TRUNCATE estabelecimento_atendimento, estabelecimento_servico, estabelecimento_horario, "
                    "estabelecimento, municipio, regiao_saude, macrorregiao RESTART IDENTITY CASCADE")
        copiar(cur, "macrorregiao", ["cd", "nome", "geom"],
               ((r.cd, r.nome, hexgeom(r.geometry)) for r in mac.itertuples()))
        copiar(cur, "regiao_saude", ["cd", "nome", "cd_macro", "geom"],
               ((r.cd, r.nome, r.cd_macro, hexgeom(r.geometry)) for r in reg.itertuples()))
        copiar(cur, "municipio", ["cd", "cd6", "nome", "cd_regiao", "cd_macro", "populacao", "area_km2", "densidade", "geom"],
               ((r.cd, r.cd6, r.nome, r.cd_regiao, r.cd_macro, nn(r.populacao), nn(r.area_km2), nn(r.densidade),
                 hexgeom(r.geometry)) for r in mun.itertuples()))
        copiar(cur, "estabelecimento",
               ["cnes", "nome", "razao_social", "tp_unidade", "categoria", "cd_municipio", "logradouro", "numero",
                "complemento", "bairro", "cep", "telefone", "email", "natureza", "sempre_aberto", "turno",
                "coord_ok", "atualizado_em", "geom"],
               ((r.cnes, r.nome, nn(r.razao_social), int(r.tp_unidade), r.categoria, r.cd_municipio, nn(r.logradouro),
                 nn(r.numero), nn(r.complemento), nn(r.bairro), nn(r.cep), nn(r.telefone), nn(r.email), r.natureza,
                 bool(r.sempre_aberto), nn(r.turno), bool(r.coord_ok), nn(r.atualizado_em), ponto(r.lon, r.lat))
                for r in est.itertuples()))
        copiar(cur, "estabelecimento_horario", ["cnes", "dia", "abre", "fecha"],
               ((r.cnes, int(r.dia_n), r.abre, r.fecha) for r in hv.itertuples()))
        copiar(cur, "estabelecimento_servico",
               ["cnes", "cd_servico", "servico", "cd_classificacao", "classificacao", "sus"],
               ((r.cnes, r.cd_servico, r.servico, r.cd_classificacao, nn(r.classificacao), bool(r.sus))
                for r in sv.itertuples()))
        copiar(cur, "estabelecimento_atendimento", ["cnes", "atendimento", "sus"],
               ((r.cnes, r.atendimento, bool(r.sus)) for r in at.itertuples()))

        # verificações sobre o que REALMENTE entrou no banco
        cont = {k: cur.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
                for k, t in (("municipios", "municipio"), ("regioes", "regiao_saude"),
                             ("macros", "macrorregiao"), ("universo", "estabelecimento"))}
        erros = verificar(cont, cont["universo"])
        relatorio["verificacoes"] = {"contagens_no_banco": cont, "erros": erros}
        escrever_md(relatorio, erros)
        if erros:
            conn.rollback()
            return erros
        cur.execute("INSERT INTO carga (competencia, fontes, relatorio) VALUES (%s, %s, %s)",
                    (COMP, json.dumps(fontes), json.dumps(relatorio, ensure_ascii=False, default=str)))
        conn.commit()
    return []


# ---------------------------------------------------------------- tiles
def tippecanoe(saida: Path, camadas: list[tuple[str, Path]], args: list[str]) -> None:
    saida.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["tippecanoe", "-o", str(saida), "--force", "--quiet", "--temporary-directory", str(INTERIM.resolve()), *args]
    for nome, arq in camadas:
        cmd += ["-L", f"{nome}:{arq}"]
    log("tippecanoe " + saida.name)
    subprocess.run(cmd, check=True)


def gerar_tiles(terr_: dict, setores_arq: Path) -> None:
    arrend = lambda g, **k: g.assign(**{c: g[c].round(n) for c, n in k.items()})  # noqa: E731
    mun = terr_["municipios"].drop(columns=["cd6", "area_malha_km2"])
    mun = arrend(mun, densidade=2, estab_por_10mil=2, area_km2=2)
    mun = mun.drop(columns=["area_km2"])
    mun_arq = INTERIM / "municipios.geojsonseq"
    _escrever_geojsonseq(mun, mun_arq)
    reg_arq, mac_arq = INTERIM / "regioes.geojsonseq", INTERIM / "macros.geojsonseq"
    _escrever_geojsonseq(arrend(terr_["regioes"], estab_por_10mil=2), reg_arq)
    _escrever_geojsonseq(arrend(terr_["macros"], estab_por_10mil=2), mac_arq)
    # detect-shared-borders: bordas compartilhadas simplificadas igual (sem frestas entre municípios)
    comuns = ["--no-tile-size-limit", "--detect-shared-borders", "--simplification=4"]
    tippecanoe(TILES / "municipios.pmtiles", [("municipios", mun_arq)], ["-Z4", "-z10", *comuns])
    tippecanoe(TILES / "regioes.pmtiles", [("regioes", reg_arq), ("macros", mac_arq)], ["-Z4", "-z10", *comuns])
    # setores: tiles pesados -> sem detect-shared-borders; descarta o mais denso se estourar o limite
    tippecanoe(TILES / "setores.pmtiles", [("setores", setores_arq)],
               ["-Z9", "-z13", "--simplification=4", "--drop-densest-as-needed"])


# ---------------------------------------------------------------- main
def main() -> int:
    log(f"carga CNES {COMP}")
    baixar.main()  # idempotente: só baixa o que falta e atualiza data/raw/fontes.json
    extrair()
    con = duckdb.connect()
    con.execute("SET memory_limit='1500MB'")
    terr_ = carregar_territorio(con)
    log(f"municípios: {len(terr_['municipios'])}")
    dados = carregar_estabelecimentos(con, terr_)
    montar_agregados(terr_, dados["est"])
    log(f"universo: {len(dados['est'])}")
    setores = preparar_setores(terr_["municipios"])
    log(f"setores: {setores['carregados']}")

    mun = terr_["municipios"]
    rel = dados["relatorio"]
    rel["competencia"] = COMP
    rel["executada_em"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rel["territorio"] = {
        "municipios": len(mun), "regioes": len(terr_["regioes"]), "macros": len(terr_["macros"]),
        "municipios_sem_populacao": mun[mun.populacao.isna()].nome.tolist(),
        "populacao_total": int(mun.populacao.sum()),
    }
    setores_arq = Path(setores.pop("arquivo"))
    rel["setores"] = setores
    fontes = json.loads((RAW / "fontes.json").read_text()) if (RAW / "fontes.json").exists() else {}

    erros = carregar_banco(terr_, dados, fontes, rel)
    if erros:
        log("CARGA REVERTIDA: " + "; ".join(erros))
        return 1
    log("carga confirmada no banco")
    gerar_tiles(terr_, setores_arq)
    log("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
