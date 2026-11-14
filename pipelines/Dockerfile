# Ambiente reprodutível dos pipelines de dados (ETL).
# Uso: ver pipelines/README.md
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# tippecanoe (vector tiles, saída .pmtiles) — pacote Debian trixie
RUN apt-get update \
 && apt-get install -y --no-install-recommends tippecanoe \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo
COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt
