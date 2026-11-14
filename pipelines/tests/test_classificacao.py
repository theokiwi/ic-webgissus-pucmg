"""Especificação da classificação (ADR 0003)."""

import pytest

from etl.classificacao import (
    CATEGORIA_POR_TIPO,
    EXCLUIDOS,
    PENDENTES,
    classificar_tipo_unidade,
    slugs_validos,
    tipo_conhecido,
)


@pytest.mark.parametrize(
    ("tp", "esperado"),
    [
        (1, "atencao_basica"),
        (2, "atencao_basica"),
        (73, "urgencia"),
        (20, "urgencia"),
        (21, "urgencia"),
        (5, "hospital"),
        (7, "hospital"),
        (15, "hospital"),
        (62, "hospital"),
        (39, "laboratorio"),
        (4, "especialidades"),
        (36, "especialidades"),
        (70, "saude_mental"),
        (43, "farmacia"),
        (22, "especialidades"),
        (79, "especialidades"),
        (61, "hospital"),
        (85, "vacinacao"),
        (69, "hemocentro"),
        (74, "promocao_saude"),
        (83, "promocao_saude"),
    ],
)
def test_tipos_aprovados(tp, esperado):
    assert classificar_tipo_unidade(tp) == esperado


@pytest.mark.parametrize("tp", [76, 81, 84, 75, 40, 42, 16, 50, 60, 68, 71, 72, 77, 80, 82])
def test_tipos_nao_visitaveis_ficam_fora(tp):
    assert classificar_tipo_unidade(tp) is None


def test_todo_slug_devolvido_existe_no_contrato():
    devolvidos = {classificar_tipo_unidade(tp) for tp in range(0, 100)} - {None}
    assert devolvidos <= slugs_validos()


def test_contrato_tem_sete_categorias():
    assert len(slugs_validos()) == 10


def test_grupos_nao_se_sobrepoem():
    assert not set(CATEGORIA_POR_TIPO) & EXCLUIDOS
    assert not set(CATEGORIA_POR_TIPO) & PENDENTES
    assert not EXCLUIDOS & PENDENTES


def test_pendentes_ficam_fora_ate_decisao():
    assert all(classificar_tipo_unidade(tp) is None for tp in PENDENTES)


def test_todos_os_tipos_vistos_em_mg_202609_tem_decisao():
    vistos = {1, 2, 4, 5, 7, 15, 16, 20, 21, 22, 36, 39, 40, 42, 43, 50, 60, 61, 62, 68, 69,
              70, 71, 72, 73, 74, 75, 76, 77, 79, 80, 81, 82, 83, 84, 85}
    assert all(tipo_conhecido(tp) for tp in vistos)


def test_codigo_desconhecido_fica_fora_e_e_sinalizado():
    assert classificar_tipo_unidade(999) is None
    assert not tipo_conhecido(999)
    assert tipo_conhecido(2) and tipo_conhecido(76) and tipo_conhecido(68)
