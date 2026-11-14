# pipelines

ETL em Python (ADR 0002). Sempre executado em Docker.

```
pipelines/run.sh spike/explorar_cnes.py 202609   # roda um script
pipelines/test.sh                                # pytest
```

## Dados brutos esperados (não versionados)

| Arquivo | Origem |
|---|---|
| `data/raw/cnes/BASE_DE_DADOS_CNES_AAAAMM.ZIP` | `ftp://ftp.datasus.gov.br/cnes/` |
| `data/raw/territorio/*base_territorial*.zip` | `ftp://ftp.datasus.gov.br/territorio/tabelas/<ano>/` |
| `data/raw/ibge/MG_Municipios_2024.zip` | `https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/UFs/MG/` |

## Pastas

- `etl/` — código de produção (classificação, filtros, cargas).
- `spike/` — exploração descartável; resultados em `docs/spike/`.
- `tests/` — pytest.
