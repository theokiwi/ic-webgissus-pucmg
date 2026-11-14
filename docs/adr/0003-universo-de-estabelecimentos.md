# 0003 · Universo de estabelecimentos e agrupamento

**Status:** aceito · 2026-11-14 (tipos pendentes resolvidos no mesmo dia, por delegação do autor)

## Contexto
O objetivo é mostrar onde o cidadão pode ser atendido **gratuitamente pelo SUS**. O spike (`docs/spike/cnes-mg-202609.md`) mediu a base de MG:

- 78.992 registros ligados a MG; 64.706 ativos; **16.759 ativos e com atendimento SUS**.
- Do universo SUS: 75,8% administração pública, 19,1% empresarial, 4,8% sem fins lucrativos — ou seja, o critério "SUS" inclui ~4 mil privados/filantrópicos conveniados que um critério "natureza jurídica pública" perderia.
- 100% do universo tem coordenada; 97,4% cai dentro do próprio município, 2,6% fora (mediana 21 km de erro).

## Decisão
1. **Universo** = `CO_MOTIVO_DESAB` vazio **e** `CO_CONVENIO = '01'` em `rlEstabAtendPrestConv` **e** tipo de unidade visitável.
2. **Só entram tipos visitáveis pelo cidadão.** Excluídos: unidades móveis (40, 42), telessaúde (75), centrais de regulação (76, 81), abastecimento (84), gestão (68), órgãos (82), vigilância (50), laboratório de saúde pública (80, recebe amostras), NASF (71, equipe), atenção domiciliar (77), cooperativas (60), saúde indígena (72, público restrito) e o código 16 (sem descrição).
3. **Agrupamento** (categorias exibidas no mapa; slugs em `packages/domain/categorias.json`):

| Categoria | TP_UNIDADE |
|---|---|
| Atenção básica | 01, 02 |
| Urgência | 73, 20, 21 |
| Hospital | 05, 07, 15, 62, 61 (parto normal) |
| Laboratório/exames | 39 |
| Especialidades | 04, 36, 22 (consultório isolado SUS), 79 (oficina ortopédica) |
| Saúde mental (CAPS) | 70 |
| Farmácia | 43 |
| Vacinação *(nova)* | 85 |
| Hemocentro *(nova)* | 69 |
| Academia da Saúde e promoção *(nova)* | 74, 83 |

4. Pontos fora do próprio município **não são descartados**: recebem flag de qualidade e ficam fora apenas de "perto de mim" até serem corrigidos (geocodificação de endereço, fase posterior).

## Código desconhecido (provisório)
Um TP_UNIDADE que não esteja em nenhuma lista (tipo novo numa competência futura) fica fora do mapa e aparece no relatório de qualidade da carga. Alternativas em aberto para o autor: interromper a carga, ou exibir em "Outros".

## Consequências
- A regra vive em `pipelines/etl/classificacao.py` e é testada contra os slugs do JSON compartilhado. Pendentes ficam fora do mapa até decisão do autor; códigos fora de qualquer grupo (`tipo_conhecido` = False) também ficam fora e devem ser listados no relatório de qualidade.
- Horários: unidades 24h são identificadas por `TP_ESTAB_SEMPRE_ABERTO`; as demais por `tbEstabHorarioAtend`. A UI sempre indica "fonte CNES, competência X — confirme por telefone" e, em urgência, SAMU 192.
