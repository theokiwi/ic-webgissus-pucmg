"""Classificação dos tipos de unidade do CNES nas categorias exibidas no mapa.

Regra decidida pelo autor: docs/adr/0003-universo-de-estabelecimentos.md
Slugs válidos: packages/domain/categorias.json (fonte única, também usada pelo front).

Todo TP_UNIDADE conhecido está em exatamente um de três grupos:
  - CATEGORIA_POR_TIPO: entra no mapa com a categoria indicada (agrupamento aprovado);
  - EXCLUIDOS: não é lugar que o cidadão visita (aprovado);
  - PENDENTES: ainda sem decisão — fora do mapa até ser decidido (hoje vazio).
`tipo_conhecido` permite ao ETL listar códigos fora dos três grupos no relatório de qualidade.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

CATEGORIAS_JSON = Path(__file__).resolve().parents[2] / "packages" / "domain" / "categorias.json"

# A tabela fica aqui, e não no JSON compartilhado, para não levar códigos do CNES
# ao contrato do front: o front só conhece slugs.
CATEGORIA_POR_TIPO: dict[int, str] = {
    1: "atencao_basica",   # Posto de saúde
    2: "atencao_basica",   # Centro de saúde / Unidade básica
    73: "urgencia",        # Pronto atendimento (UPA)
    20: "urgencia",        # Pronto-socorro geral
    21: "urgencia",        # Pronto-socorro especializado
    5: "hospital",         # Hospital geral
    7: "hospital",         # Hospital especializado
    15: "hospital",        # Unidade mista
    62: "hospital",        # Hospital/dia isolado
    39: "laboratorio",     # SADT isolado (refinar por serviço na fase 3)
    4: "especialidades",   # Policlínica
    36: "especialidades",  # Clínica / centro de especialidade
    70: "saude_mental",    # CAPS
    43: "farmacia",        # Farmácia
    22: "especialidades",  # Consultório isolado (conveniado SUS)
    79: "especialidades",  # Oficina ortopédica (reabilitação)
    61: "hospital",        # Centro de parto normal
    85: "vacinacao",       # Centro de imunização
    69: "hemocentro",      # Hemoterapia/hematologia
    74: "promocao_saude",  # Polo Academia da Saúde
    83: "promocao_saude",  # Polo de prevenção de doenças e promoção da saúde
}

EXCLUIDOS: frozenset[int] = frozenset({
    40,  # Unidade móvel terrestre
    42,  # Unidade móvel pré-hospitalar de urgência (SAMU)
    75,  # Telessaúde
    76,  # Central de regulação médica das urgências
    81,  # Central de regulação do acesso
    84,  # Central de abastecimento
    16,  # Código sem descrição em tbTipoUnidade
    50,  # Vigilância em saúde (não presta atendimento)
    60,  # Cooperativa / cessão de trabalhadores
    68,  # Central de gestão em saúde (secretarias)
    71,  # Apoio à Saúde da Família (equipe, não local)
    72,  # Atenção à saúde indígena (público restrito)
    77,  # Atenção domiciliar (atende em casa)
    80,  # Laboratório de saúde pública (recebe amostras, não público)
    82,  # Central de notificação/captação de órgãos
})

# Aguardando decisão (ADR 0003).
PENDENTES: frozenset[int] = frozenset()


@cache
def slugs_validos() -> frozenset[str]:
    dados = json.loads(CATEGORIAS_JSON.read_text(encoding="utf-8"))
    return frozenset(c["slug"] for c in dados["categorias"])


def classificar_tipo_unidade(tp_unidade: int) -> str | None:
    """Devolve o slug da categoria do mapa, ou None se o tipo não entra no mapa.

    `tp_unidade` é o TP_UNIDADE do CNES já convertido para int (no CSV vem "02").
    """
    return CATEGORIA_POR_TIPO.get(tp_unidade)


def tipo_conhecido(tp_unidade: int) -> bool:
    """False para códigos que nenhuma decisão cobre."""
    return tp_unidade in CATEGORIA_POR_TIPO or tp_unidade in EXCLUIDOS or tp_unidade in PENDENTES
