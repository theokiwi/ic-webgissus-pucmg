"""Spike (descartável): mede a qualidade da base CNES para Minas Gerais.

Responde, para a competência indicada:
  - quantos estabelecimentos de MG estão ativos e atendem SUS;
  - distribuição por TP_UNIDADE (para decidir o agrupamento);
  - cobertura de coordenadas, horários e serviços;
  - coordenadas fora do próprio município (malha IBGE 2024);
  - se as regiões de saúde da base territorial cobrem os 853 municípios.

Saída: docs/spike/cnes-mg-<competencia>.md

Uso: pipelines/run.sh spike/explorar_cnes.py [AAAAMM]
"""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import duckdb
import geopandas as gpd
import pandas as pd

COMP = sys.argv[1] if len(sys.argv) > 1 else "202609"
RAW = Path("data/raw")
INTERIM = Path("data/interim/spike") / COMP
OUT = Path("docs/spike") / f"cnes-mg-{COMP}.md"

CNES_ZIP = RAW / "cnes" / f"BASE_DE_DADOS_CNES_{COMP}.ZIP"
TERR_ZIP = next((RAW / "territorio").glob("*base_territorial*.zip"))
MALHA_ZIP = RAW / "ibge" / "MG_Municipios_2024.zip"

CNES_TABELAS = [
    "tbEstabelecimento", "tbEstabHorarioAtend", "rlEstabServClass",
    "rlEstabAtendPrestConv", "tbTipoUnidade", "tbTurnoAtendimento",
]
TERR_TABELAS = [
    "tb_municip.csv", "tb_regsaud.csv", "tb_macsaud.csv",
    "rl_municip_regsaud.csv", "rl_municip_macsaud.csv",
]

# Agrupamento PROPOSTO na conversa (só para leitura do relatório).
# A regra de produção será escrita à mão em pipelines/ (TODO(human)).
PROPOSTA = {
    1: "Atenção básica", 2: "Atenção básica",
    73: "Urgência", 20: "Urgência", 21: "Urgência",
    5: "Hospital", 7: "Hospital", 15: "Hospital", 62: "Hospital",
    39: "Laboratório/exames",
    4: "Especialidades", 36: "Especialidades",
    70: "Saúde mental (CAPS)",
    43: "Farmácia",
    76: "(excluir)", 81: "(excluir)", 84: "(excluir)", 75: "(excluir)",
    40: "(excluir)", 42: "(excluir)",
}

# Envelope de MG com folga (graus).
BBOX = dict(lat_min=-23.0, lat_max=-14.2, lon_min=-51.1, lon_max=-39.8)


def extrair() -> None:
    INTERIM.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(CNES_ZIP) as z:
        for t in CNES_TABELAS:
            nome = f"{t}{COMP}.csv"
            if not (INTERIM / nome).exists():
                print(f"extraindo {nome}…", flush=True)
                z.extract(nome, INTERIM)
    with zipfile.ZipFile(TERR_ZIP) as z:
        for nome in TERR_TABELAS:
            if not (INTERIM / nome).exists():
                z.extract(nome, INTERIM)


def cnes(t: str) -> str:
    return (f"read_csv('{INTERIM}/{t}{COMP}.csv', delim=';', header=true, "
            "all_varchar=true, encoding='latin-1')")


def terr(nome: str) -> str:
    return f"read_csv('{INTERIM}/{nome}', header=true, all_varchar=true)"


def pct(a: float, b: float) -> str:
    return f"{100 * a / b:.1f}%" if b else "—"


def main() -> None:
    extrair()
    con = duckdb.connect()
    con.execute("SET memory_limit='2GB'")
    q = lambda sql: con.execute(sql).df()  # noqa: E731

    # --- estabelecimentos de MG (município de localização = 6 primeiros dígitos de CO_UNIDADE)
    con.execute(f"""
      CREATE TABLE est AS
      SELECT CO_UNIDADE, CO_CNES, NO_FANTASIA, NO_BAIRRO,
             TRY_CAST(TP_UNIDADE AS INT) AS tp,
             substr(CO_UNIDADE,1,6) AS mun6, CO_MUNICIPIO_GESTOR AS mun_gestor,
             NULLIF(trim(CO_REGIAO_SAUDE),'') AS reg_saude,
             NULLIF(trim(CO_MOTIVO_DESAB),'') AS motivo_desab,
             NULLIF(trim(CO_TURNO_ATENDIMENTO),'') AS turno,
             TP_ESTAB_SEMPRE_ABERTO AS sempre_aberto,
             CO_NATUREZA_JUR AS nat_jur,
             TRY_CAST(replace(NU_LATITUDE, ',', '.') AS DOUBLE) AS lat,
             TRY_CAST(replace(NU_LONGITUDE, ',', '.') AS DOUBLE) AS lon
      FROM {cnes('tbEstabelecimento')}
      WHERE substr(CO_UNIDADE,1,2)='31' OR CO_ESTADO_GESTOR='31'
    """)
    con.execute(f"""CREATE TABLE sus AS SELECT DISTINCT CO_UNIDADE FROM {cnes('rlEstabAtendPrestConv')}
                    WHERE CO_CONVENIO='01' AND substr(CO_UNIDADE,1,2)='31'""")
    con.execute(f"""CREATE TABLE hor AS SELECT * FROM {cnes('tbEstabHorarioAtend')}
                    WHERE substr(CO_UNIDADE,1,2)='31'""")
    con.execute(f"""CREATE TABLE serv AS SELECT CO_UNIDADE, CO_SERVICO, CO_AMBULATORIAL_SUS, CO_HOSPITALAR_SUS
                    FROM {cnes('rlEstabServClass')} WHERE substr(CO_UNIDADE,1,2)='31'""")
    con.execute(f"""CREATE TABLE tipos AS SELECT TRY_CAST(CO_TIPO_UNIDADE AS INT) tp, DS_TIPO_UNIDADE ds
                    FROM {cnes('tbTipoUnidade')}""")
    con.execute(f"""
      CREATE TABLE base AS
      SELECT e.*,
        motivo_desab IS NULL AS ativo,
        CO_UNIDADE IN (SELECT CO_UNIDADE FROM sus) AS atende_sus,
        lat IS NOT NULL AND lon IS NOT NULL AND lat<>0 AND lon<>0 AS tem_coord,
        lat BETWEEN {BBOX['lat_min']} AND {BBOX['lat_max']}
          AND lon BETWEEN {BBOX['lon_min']} AND {BBOX['lon_max']} AS coord_bbox_mg,
        CO_UNIDADE IN (SELECT CO_UNIDADE FROM hor) AS tem_horario,
        CO_UNIDADE IN (SELECT CO_UNIDADE FROM serv) AS tem_servico
      FROM est e
    """)

    r: list[str] = [f"# Spike CNES · Minas Gerais · competência {COMP[:4]}-{COMP[4:]}\n",
                    "Gerado por `pipelines/spike/explorar_cnes.py`. Exploratório: números para decidir, "
                    "não para publicar.\n"]

    g = q("""SELECT count(*) n,
                    count(*) FILTER (WHERE substr(CO_UNIDADE,1,2)<>'31') fora_uf_local,
                    count(*) FILTER (WHERE mun6<>mun_gestor) gestor_diferente,
                    count(*) FILTER (WHERE ativo) ativos,
                    count(*) FILTER (WHERE ativo AND atende_sus) universo
             FROM base""").iloc[0]
    n, uni = int(g.n), int(g.universo)
    r += ["## 1. Tamanho do universo\n",
          "| Recorte | Estabelecimentos |", "|---|---:|",
          f"| Registros ligados a MG (local ou gestor) | {n:,} |",
          f"| …localizados fora de MG (só gestão MG) | {int(g.fora_uf_local):,} |",
          f"| …município gestor ≠ município de localização | {int(g.gestor_diferente):,} |",
          f"| Ativos (sem motivo de desativação) | {int(g.ativos):,} |",
          f"| **Ativos e atendem SUS** (convênio 01 em rlEstabAtendPrestConv) | **{uni:,}** |\n"]

    # --- por tipo de unidade, dentro do universo
    por_tipo = q("""
      SELECT b.tp, t.ds, count(*) n,
             count(*) FILTER (WHERE tem_coord AND coord_bbox_mg) coord_ok,
             count(*) FILTER (WHERE tem_horario) horario,
             count(*) FILTER (WHERE sempre_aberto='S') sempre_aberto,
             count(*) FILTER (WHERE tem_servico) servico
      FROM base b LEFT JOIN tipos t USING (tp)
      WHERE ativo AND atende_sus AND substr(CO_UNIDADE,1,2)='31'
      GROUP BY ALL ORDER BY n DESC
    """)
    por_tipo.insert(2, "grupo_proposto", por_tipo.tp.map(PROPOSTA).fillna("(a decidir)"))
    for c in ["coord_ok", "horario", "sempre_aberto", "servico"]:
        por_tipo[c] = [pct(a, b) for a, b in zip(por_tipo[c], por_tipo.n)]
    r += ["## 2. Por tipo de unidade (universo: ativos + SUS, localizados em MG)\n",
          "Percentuais sobre o `n` de cada linha. `coord_ok` = coordenada preenchida e dentro do envelope de MG.\n",
          por_tipo.to_markdown(index=False), "\n"]

    grupos = (por_tipo.assign(n=por_tipo.n.astype(int)).groupby("grupo_proposto").n.sum()
              .sort_values(ascending=False).reset_index())
    r += ["### Totais pelo agrupamento proposto\n", grupos.to_markdown(index=False), "\n"]

    # --- natureza jurídica (público x privado conveniado)
    nat = q("""
      SELECT CASE substr(nat_jur,1,1) WHEN '1' THEN 'Administração pública'
                                      WHEN '2' THEN 'Entidade empresarial'
                                      WHEN '3' THEN 'Sem fins lucrativos'
                                      WHEN '4' THEN 'Pessoa física'
                                      ELSE 'Não informado' END natureza, count(*) n
      FROM base WHERE ativo AND atende_sus AND substr(CO_UNIDADE,1,2)='31' GROUP BY 1 ORDER BY 2 DESC""")
    r += ["## 3. Natureza jurídica do universo SUS\n", nat.to_markdown(index=False), "\n"]

    # --- coordenadas: ponto-no-polígono contra a malha IBGE 2024
    pts = q("""SELECT CO_UNIDADE, mun6, tp, lat, lon FROM base
               WHERE ativo AND atende_sus AND substr(CO_UNIDADE,1,2)='31' AND tem_coord""")
    malha = gpd.read_file(f"zip://{MALHA_ZIP}").to_crs(4674)
    malha["mun6"] = malha["CD_MUN"].str[:6]
    gpts = gpd.GeoDataFrame(pts, geometry=gpd.points_from_xy(pts.lon, pts.lat), crs=4674)
    j = gpd.sjoin(gpts, malha[["mun6", "geometry"]].rename(columns={"mun6": "mun6_malha"}),
                  how="left", predicate="within")
    dentro = int((j.mun6 == j.mun6_malha).sum())
    outro = int((j.mun6_malha.notna() & (j.mun6 != j.mun6_malha)).sum())
    fora = int(j.mun6_malha.isna().sum())
    errados = j[j.mun6 != j.mun6_malha].copy()
    m_proj = malha.set_index("mun6").to_crs(5880)
    e_proj = errados.to_crs(5880)
    dist = [geom.distance(m_proj.geometry.get(m)) / 1000 if m in m_proj.index else float("nan")
            for geom, m in zip(e_proj.geometry, e_proj.mun6)]
    dist_s = pd.Series(dist).dropna()
    dup = q("""SELECT count(*) n FROM (
                 SELECT lat, lon, count(*) c FROM base
                 WHERE ativo AND atende_sus AND substr(CO_UNIDADE,1,2)='31' AND tem_coord
                 GROUP BY 1,2 HAVING c>=3)""").n.iloc[0]
    sem = uni - len(pts)
    r += ["## 4. Qualidade das coordenadas (universo SUS)\n",
          "| Situação | n | % do universo |", "|---|---:|---:|",
          f"| Sem coordenada | {sem:,} | {pct(sem, uni)} |",
          f"| Dentro do próprio município | {dentro:,} | {pct(dentro, uni)} |",
          f"| Em **outro** município de MG | {outro:,} | {pct(outro, uni)} |",
          f"| Fora de MG / no mar / invertida | {fora:,} | {pct(fora, uni)} |",
          "",
          f"Distância até o próprio município, para os pontos errados: mediana "
          f"{dist_s.median():.1f} km, p90 {dist_s.quantile(.9):.1f} km (n={len(dist_s)}).\n",
          f"Coordenadas idênticas compartilhadas por 3+ estabelecimentos: {int(dup)} pontos "
          "(sinal de geocodificação genérica, ex.: sede da prefeitura).\n"]

    # --- horários
    dias = q("SELECT CO_DIA_SEMANA dia, count(*) n FROM hor GROUP BY 1 ORDER BY 1")
    turno = q(f"""SELECT coalesce(t.DS_TURNO_ATENDIMENTO,'(vazio)') turno, count(*) n
                  FROM base b LEFT JOIN {cnes('tbTurnoAtendimento')} t ON t.CO_TURNO_ATENDIMENTO=b.turno
                  WHERE ativo AND atende_sus AND substr(CO_UNIDADE,1,2)='31' GROUP BY 1 ORDER BY 2 DESC""")
    exemplo = q("""SELECT h.CO_UNIDADE, h.CO_DIA_SEMANA, h.HR_INICIO_ATENDIMENTO, h.HR_FIM_ATENDIMENTO
                   FROM hor h JOIN base b USING (CO_UNIDADE) WHERE b.tp=73 ORDER BY 1,2 LIMIT 8""")
    r += ["## 5. Horários de funcionamento\n",
          "Linhas de `tbEstabHorarioAtend` por código de dia (MG):\n", dias.to_markdown(index=False), "\n",
          "Turno declarado em `tbEstabelecimento` (universo SUS):\n", turno.to_markdown(index=False), "\n",
          "Amostra de horários de unidades de Pronto Atendimento (73):\n", exemplo.to_markdown(index=False), "\n"]

    # --- regiões de saúde (base territorial DATASUS)
    mun = q(f"SELECT CO_MUNICIP, CO_MUNICDV FROM {terr('tb_municip.csv')} WHERE UF='MG' AND CO_STATUS='ATIVO'")
    rl_reg = q(f"SELECT * FROM {terr('rl_municip_regsaud.csv')}")
    rl_mac = q(f"SELECT * FROM {terr('rl_municip_macsaud.csv')}")
    nomes_mac = q(f"SELECT CO_MACSAUD, DS_NOME FROM {terr('tb_macsaud.csv')} WHERE CO_MACSAUD LIKE '31%'")
    reg_mg = rl_reg[rl_reg.CO_MUNICIP.isin(mun.CO_MUNICIP)]
    mac_mg = rl_mac[rl_mac.CO_MUNICIP.isin(mun.CO_MUNICIP)]
    est_reg = q("""SELECT count(DISTINCT reg_saude) n FROM base WHERE substr(CO_UNIDADE,1,2)='31'""").n.iloc[0]
    macs = (mac_mg.merge(nomes_mac, on="CO_MACSAUD", how="left").groupby(["CO_MACSAUD", "DS_NOME"])
            .size().reset_index(name="municipios"))
    r += ["## 6. Regiões de saúde (base territorial DATASUS)\n",
          "| Verificação | Valor |", "|---|---:|",
          f"| Municípios ativos de MG em tb_municip | {len(mun)} |",
          f"| …com par na malha IBGE 2024 (CO_MUNICDV = CD_MUN) | {int(mun.CO_MUNICDV.isin(malha.CD_MUN).sum())} |",
          f"| Regiões de saúde distintas | {reg_mg.CO_REGSAUD.nunique()} |",
          f"| Macrorregiões de saúde distintas | {mac_mg.CO_MACSAUD.nunique()} |",
          f"| Municípios sem região de saúde | {len(mun) - reg_mg.CO_MUNICIP.nunique()} |",
          f"| Municípios sem macrorregião | {len(mun) - mac_mg.CO_MUNICIP.nunique()} |",
          f"| Códigos distintos de CO_REGIAO_SAUDE em tbEstabelecimento (MG) | {int(est_reg)} |\n",
          "Macrorregiões:\n", macs.to_markdown(index=False), "\n"]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(r), encoding="utf-8")
    print("\n".join(r))
    print(f"\n→ relatório salvo em {OUT}")


if __name__ == "__main__":
    main()
