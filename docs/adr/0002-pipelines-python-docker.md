# 0002 · ETL em Python, em lote mensal, dentro de Docker

**Status:** aceito · 2026-11-14

## Contexto
Fontes: CNES (base mensal `BASE_DE_DADOS_CNES_AAAAMM.ZIP`, ~745 MB, FTP DATASUS), base territorial DATASUS, malhas e Censo IBGE, OSM e Overture (GeoParquet). O ecossistema geoespacial de Python (DuckDB, geopandas, pyogrio) é mais maduro que o de Node. O ambiente de desenvolvimento é NixOS, onde wheels binárias de Python falham fora de containers.

## Decisão
- Pipelines em **Python 3.13**, dependências fixadas em `pipelines/requirements.txt`, executados **sempre em Docker** (`pipelines/run.sh`, `pipelines/test.sh`).
- Execução **em lote**, uma vez por competência do CNES. A API só lê o resultado; nunca consulta o DATASUS em tempo de requisição.
- Dados brutos em `data/raw/`, intermediários em `data/interim/`, nunca versionados. Toda carga registra a competência (`AAAAMM`).
- Cada carga gera um **relatório de qualidade** (ver `docs/spike/`) e falha se verificações básicas quebrarem (ex.: 853 municípios, universo vazio).

## Consequências
- Rodar o ETL exige Docker; o resto do app não.
- Docker com `--network host` por causa do DNS do NixOS.
