# pipelines

ETL em Python (ADR 0002). Sempre executado em Docker.

```
pipelines/run.sh spike/explorar_cnes.py 202609   # roda um script
pipelines/test.sh                                # pytest
pipelines/run.sh etl/carga.py 202609             # ETL completo: baixa o que falta, carrega o PostGIS e gera os tiles
```

## Carga de produção (`etl/carga.py`)

Pré-requisito: PostGIS no ar (`pnpm db:up`). `DATABASE_URL` é opcional
(padrão `postgres://webgissus:webgissus_dev@127.0.0.1:5432/webgissus`).

1. `baixar.py` (chamado pela carga; idempotente) baixa o que falta e grava as URLs em `data/raw/fontes.json`.
2. DuckDB filtra MG; `transformacoes.py` tem as regras puras (testadas); `classificacao.py` tem as categorias.
3. Uma única transação: aplica `infra/db/001_schema.sql`, `TRUNCATE ... CASCADE` das tabelas de dados e `COPY`.
   Falha com rollback e exit 1 se municípios != 853, regiões != 89, macros != 16 ou universo < 10.000.
   Grava uma linha em `carga` (fontes + relatório JSON).
4. Relatório legível: `docs/qualidade/carga-AAAAMM.md`.
5. Tiles (tippecanoe, instalado no Dockerfile) em `data/processed/tiles/`: `municipios.pmtiles`
   (camada `municipios`), `regioes.pmtiles` (camadas `regioes` e `macros`), `setores.pmtiles` (camada `setores`, minzoom 9).

Notas de dados: SIDRA 4714 (v93 população, v6318 área) para o Censo 2022 por município; população por setor =
`v0001` (total de pessoas) do agregado "básico" (a soma bate com a dos municípios); flags de serviço do CNES:
`'1'` = sim, `'2'` = não; horários do CNES truncados/ambíguos (`08:0`, `00:8`) são descartados e contados no relatório.

## Dados brutos esperados (não versionados)

| Arquivo | Origem |
|---|---|
| `data/raw/cnes/BASE_DE_DADOS_CNES_AAAAMM.ZIP` | `ftp://ftp.datasus.gov.br/cnes/` |
| `data/raw/territorio/*base_territorial*.zip` | `ftp://ftp.datasus.gov.br/territorio/tabelas/<ano>/` |
| `data/raw/ibge/censo2022_municipios_mg.json` | `https://apisidra.ibge.gov.br/values/t/4714/n6/in%20n3%2031/v/93,6318/p/2022` |
| `data/raw/ibge/MG_setores_CD2022.zip` | `https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/shp/UF/` |
| `data/raw/ibge/Agregados_por_setores_basico_BR_20260520.zip` | `https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/` |
| `data/raw/ibge/MG_Municipios_2024.zip` | `https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/UFs/MG/` |

## Pastas

- `etl/` — código de produção (classificação, filtros, cargas).
- `spike/` — exploração descartável; resultados em `docs/spike/`.
- `tests/` — pytest.
