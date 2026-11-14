"""Transformações puras do ETL (CLAUDE.md: dia da semana, natureza, coord_ok, horário)."""

from datetime import date

import pytest
from shapely.geometry import MultiPolygon, Point, Polygon, box

from etl.transformacoes import (
    coord_ok, coord_ok_lote, coord_valida, densidade, dia_semana, nome_macro, nome_regiao, natureza,
    numero_br, para_multipolygon, parse_data_br, parse_hora, por_10mil,
)


@pytest.mark.parametrize("cnes,esperado", [("1", 0), ("2", 1), ("7", 6), (4, 3), (" 3 ", 2)])
def test_dia_semana_converte_1_domingo_para_0(cnes, esperado):
    assert dia_semana(cnes) == esperado


@pytest.mark.parametrize("invalido", ["0", "8", "", None, "x", "-1"])
def test_dia_semana_invalido(invalido):
    assert dia_semana(invalido) is None


@pytest.mark.parametrize("cod,esperado", [
    ("1244", "publica"), ("2062", "empresarial"), ("3999", "sem_fins_lucrativos"),
    ("4000", "pessoa_fisica"), ("5000", "nao_informada"), ("", "nao_informada"), (None, "nao_informada"),
    ("9", "nao_informada"),
])
def test_natureza_pelo_primeiro_digito(cod, esperado):
    assert natureza(cod) == esperado


@pytest.mark.parametrize("texto,esperado", [
    ("08:00", "08:00"), ("8:00", "08:00"), ("8 :00", "08:00"), ("23:59", "23:59"), ("00:00", "00:00"),
])
def test_parse_hora_formatos_validos(texto, esperado):
    assert parse_hora(texto) == esperado


@pytest.mark.parametrize("texto", ["08:0", "00:8", "18: 0", "20:0", "24:00", "12:60", "", None, "abc"])
def test_parse_hora_truncado_ou_invalido_nao_e_adivinhado(texto):
    assert parse_hora(texto) is None


def test_parse_data_br():
    assert parse_data_br("04/09/2026") == date(2026, 9, 4)
    assert parse_data_br("") is None
    assert parse_data_br("31/02/2026") is None


MUN_A = box(0, 0, 1, 1)
MUN_B = box(1, 0, 2, 1)


def test_coord_ok_dentro_do_proprio_municipio():
    assert coord_ok(0.5, 0.5, MUN_A)


def test_coord_ok_em_outro_municipio_e_falso():
    assert not coord_ok(1.5, 0.5, MUN_A)


def test_coord_ok_sem_poligono_ou_coordenada():
    assert not coord_ok(0.5, 0.5, None)
    assert not coord_ok(None, 0.5, MUN_A)
    assert not coord_ok(0, 0, box(-1, -1, 1, 1))  # (0,0) conta como ausente


def test_coord_ok_lote_um_poligono_por_ponto():
    res = coord_ok_lote([0.5, 0.5, 1.5, None], [0.5, 0.5, 0.5, 0.5], [MUN_A, MUN_B, MUN_B, MUN_A])
    assert res == [True, False, True, False]


def test_coord_valida():
    assert coord_valida(-43.9, -19.9)
    assert not coord_valida(None, -19.9)
    assert not coord_valida(0.0, 0.0)
    assert not coord_valida(float("nan"), -19.9)


def test_para_multipolygon():
    p = Polygon([(0, 0), (1, 0), (1, 1)])
    assert isinstance(para_multipolygon(p), MultiPolygon)
    mp = MultiPolygon([p])
    assert para_multipolygon(mp) is mp
    with pytest.raises(ValueError):
        para_multipolygon(Point(0, 0))


def test_densidade_e_por_10mil():
    assert densidade(1000, 10) == 100
    assert densidade(None, 10) is None
    assert densidade(10, 0) is None
    assert por_10mil(5, 10_000) == 5
    assert por_10mil(5, None) is None
    assert por_10mil(5, 0) is None


def test_numero_br():
    assert numero_br("0,5393") == pytest.approx(0.5393)
    assert numero_br("928") == 928
    assert numero_br(".") is None
    assert numero_br("...") is None
    assert numero_br(None) is None


@pytest.mark.parametrize("bruto,esperado", [
    ("Belo Horizonte/Nova Lima/Santa Luzia   - MG", "Belo Horizonte/Nova Lima/Santa Luzia"),
    ("Juiz de Fora - MG", "Juiz de Fora"),
    ("Varginha-MG", "Varginha"),
    ("Uberaba  -  MG  ", "Uberaba"),
    ("Montes  Claros", "Montes Claros"),
])
def test_nome_regiao_remove_sufixo_e_colapsa_espacos(bruto, esperado):
    assert nome_regiao(bruto) == esperado


@pytest.mark.parametrize("bruto,esperado", [
    ("SUL", "Sul"),
    ("CENTRO SUL", "Centro Sul"),
    ("TRIANGULO DO NORTE", "Triângulo do Norte"),
    ("VALE DO ACO", "Vale do Aço"),
    ("LESTE DO SUL", "Leste do Sul"),
    ("  NORDESTE ", "Nordeste"),
])
def test_nome_macro_acentua_pelo_dicionario(bruto, esperado):
    assert nome_macro(bruto) == esperado


def test_nome_macro_fora_do_dicionario_usa_title():
    assert nome_macro("  NOVA ZONA  ") == "Nova Zona"
