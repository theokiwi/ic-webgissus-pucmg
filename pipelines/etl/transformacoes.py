"""Transformações puras do ETL (sem I/O), testadas em tests/test_transformacoes.py.

Regras: docs/adr/0003 e CLAUDE.md (raiz). Nada aqui lê arquivo ou banco.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterable

import numpy as np
import shapely
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry

# 1º dígito de CO_NATUREZA_JUR (tabela de natureza jurídica do CNES/IBGE)
NATUREZA_POR_DIGITO = {
    "1": "publica",
    "2": "empresarial",
    "3": "sem_fins_lucrativos",
    "4": "pessoa_fisica",
}


def natureza(co_natureza_jur: str | None) -> str:
    """Classifica pelo 1º dígito; qualquer outra coisa (vazio, 5, 9...) vira 'nao_informada'."""
    s = (co_natureza_jur or "").strip()
    return NATUREZA_POR_DIGITO.get(s[:1], "nao_informada")


_SUFIXO_UF = re.compile(r"\s*-\s*MG\s*$")
_ESPACOS = re.compile(r"\s+")

# Nomes das 16 macrorregiões de saúde de MG (DS_NOME da base territorial DATASUS, em maiúsculas)
MACRO_NOMES = {
    "SUL": "Sul",
    "CENTRO SUL": "Centro Sul",
    "CENTRO": "Centro",
    "JEQUITINHONHA": "Jequitinhonha",
    "OESTE": "Oeste",
    "LESTE": "Leste",
    "SUDESTE": "Sudeste",
    "NORTE": "Norte",
    "NOROESTE": "Noroeste",
    "LESTE DO SUL": "Leste do Sul",
    "NORDESTE": "Nordeste",
    "TRIANGULO DO SUL": "Triângulo do Sul",
    "TRIANGULO DO NORTE": "Triângulo do Norte",
    "VALE DO ACO": "Vale do Aço",
    "EXTREMO SUL": "Extremo Sul",
    "SUDOESTE": "Sudoeste",
}


def nome_regiao(bruto: str) -> str:
    """Remove o sufixo ' - MG' e colapsa espaços: 'Belo Horizonte/Nova Lima/Santa Luzia   - MG' -> 'Belo Horizonte/Nova Lima/Santa Luzia'."""
    return _ESPACOS.sub(" ", _SUFIXO_UF.sub("", bruto)).strip()


def nome_macro(bruto: str) -> str:
    """Título em português com acentos para as macrorregiões de MG; fora do dicionário, title()."""
    chave = _ESPACOS.sub(" ", bruto).strip().upper()
    return MACRO_NOMES.get(chave, bruto.strip().title())


def dia_semana(co_dia_cnes: str | int | None) -> int | None:
    """CNES: 1=domingo … 7=sábado  ->  0=domingo … 6=sábado. Fora de 1..7 devolve None."""
    try:
        d = int(str(co_dia_cnes).strip())
    except (TypeError, ValueError):
        return None
    return d - 1 if 1 <= d <= 7 else None


_HORA = re.compile(r"^(\d{1,2}):(\d{2})$")


def parse_hora(texto: str | None) -> str | None:
    """Converte 'H:MM', 'HH:MM' (e '8 :00', com espaços) em 'HH:MM'.

    O CNES guarda horário em campo de 5 caracteres e há valores truncados/ambíguos
    ('08:0', '00:8', '18: 0'). Esses NÃO são adivinhados: devolvem None e são
    contados no relatório de qualidade.
    """
    s = re.sub(r"\s+", "", texto or "")
    m = _HORA.match(s)
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return None
    return f"{h:02d}:{mi:02d}"


def parse_data_br(texto: str | None) -> date | None:
    """'DD/MM/AAAA' -> date (None se vazio/inválido)."""
    try:
        return datetime.strptime((texto or "").strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def coord_valida(lon: float | None, lat: float | None) -> bool:
    """Coordenada preenchida e diferente de (0, 0)/zero em algum eixo (ver spike)."""
    return lon is not None and lat is not None and lon != 0 and lat != 0 \
        and not (np.isnan(lon) or np.isnan(lat))


def coord_ok(lon: float, lat: float, poligono: BaseGeometry | None) -> bool:
    """Ponto dentro do polígono do PRÓPRIO município (ADR 0003, item 4)."""
    if poligono is None or not coord_valida(lon, lat):
        return False
    return bool(shapely.contains_xy(poligono, lon, lat))


def coord_ok_lote(lons: Iterable[float | None], lats: Iterable[float | None],
                  poligonos: Iterable[BaseGeometry | None]) -> list[bool]:
    """Versão vetorizada de coord_ok (um polígono por ponto).

    Agrupa os pontos por polígono (mesmo objeto) para chamar contains_xy uma vez por
    município; polígono None ou coordenada inválida resultam em False.
    """
    xs = np.array([np.nan if v is None else v for v in lons], dtype=float)
    ys = np.array([np.nan if v is None else v for v in lats], dtype=float)
    res = np.zeros(len(xs), dtype=bool)
    grupos: dict[int, tuple[BaseGeometry, list[int]]] = {}
    for i, g in enumerate(poligonos):
        if g is not None:
            grupos.setdefault(id(g), (g, []))[1].append(i)
    for g, idx in grupos.values():
        ix = np.array(idx)
        x, y = xs[ix], ys[ix]
        valido = np.isfinite(x) & np.isfinite(y) & (x != 0) & (y != 0)
        res[ix[valido]] = shapely.contains_xy(g, x[valido], y[valido])
    return res.tolist()


def para_multipolygon(g: BaseGeometry) -> MultiPolygon:
    """O esquema exige MultiPolygon; geometrias colapsadas viram erro explícito."""
    if isinstance(g, MultiPolygon):
        return g
    if isinstance(g, Polygon):
        return MultiPolygon([g])
    partes = [p for p in getattr(g, "geoms", []) if isinstance(p, (Polygon, MultiPolygon))]
    polis: list[Polygon] = []
    for p in partes:
        polis.extend(p.geoms if isinstance(p, MultiPolygon) else [p])
    if not polis:
        raise ValueError(f"geometria sem polígonos: {g.geom_type}")
    return MultiPolygon(polis)


def densidade(populacao: int | None, area_km2: float | None) -> float | None:
    """hab/km²; None se faltar população ou área > 0."""
    if populacao is None or not area_km2 or area_km2 <= 0:
        return None
    return populacao / area_km2


def por_10mil(total: int, populacao: int | None) -> float | None:
    """Estabelecimentos por 10 mil habitantes; None sem população."""
    if not populacao:
        return None
    return total / populacao * 10_000


def numero_br(texto: str | None) -> float | None:
    """'0,5393' -> 0.5393; '.', '' e '-' -> None (convenção dos CSVs do IBGE)."""
    s = (texto or "").strip().replace(",", ".")
    if s in ("", ".", "-", "..", "...", "X"):
        return None
    try:
        return float(s)
    except ValueError:
        return None
