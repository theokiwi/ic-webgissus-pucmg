#!/usr/bin/env bash
# Prepara os tiles de roteamento do Valhalla para Minas Gerais (ADR 0005).
# Etapas (todas idempotentes; use --forcar para refazer tudo):
#   1. baixa o extrato OSM do Sudeste (Geofabrik) e confere o MD5;
#   2. recorta MG + faixa de ~30 km (osmium em container);
#   3. gera os tiles do Valhalla (container oficial).
# Uso: infra/valhalla/preparar.sh [--forcar]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RAW="$RAIZ/data/raw/osm"
INTERIM="$RAIZ/data/interim/osm"
TILES="$RAIZ/data/processed/valhalla"

IMG_OSMIUM="iboates/osmium:1.19.0"
IMG_VALHALLA="ghcr.io/valhalla/valhalla-scripted:3.9.1"
URL_BASE="https://download.geofabrik.de/south-america/brazil"
ARQ_PBF="sudeste-latest.osm.pbf"

# MG: lon -51.05..-39.85, lat -22.93..-14.23. Margem de 0,3 grau (~33 km).
# Formato do osmium: minlon,minlat,maxlon,maxlat
BBOX="-51.35,-23.23,-39.55,-13.93"

# Limites do build (a máquina de desenvolvimento é compartilhada).
MEMORIA="4g"
THREADS=4

FORCAR=0
[[ "${1:-}" == "--forcar" ]] && FORCAR=1

mkdir -p "$RAW" "$INTERIM" "$TILES"

# --- 1. Download + MD5 ---------------------------------------------------
# O .md5 do "latest" referencia o arquivo datado; baixamos ambos e comparamos.
PBF="$RAW/$ARQ_PBF"
if [[ $FORCAR -eq 1 || ! -f "$PBF" ]]; then
  echo "==> Baixando $ARQ_PBF"
  curl -fsSL --retry 3 -o "$PBF.tmp" "$URL_BASE/$ARQ_PBF"
  curl -fsSL --retry 3 -o "$PBF.md5" "$URL_BASE/$ARQ_PBF.md5"
  esperado="$(cut -d' ' -f1 "$PBF.md5")"
  obtido="$(md5sum "$PBF.tmp" | cut -d' ' -f1)"
  if [[ "$esperado" != "$obtido" ]]; then
    echo "MD5 diverge (esperado $esperado, obtido $obtido)" >&2
    rm -f "$PBF.tmp"
    exit 1
  fi
  mv "$PBF.tmp" "$PBF"
  echo "    MD5 ok ($obtido)"
else
  echo "==> Extrato já baixado: $PBF"
fi

# --- 2. Recorte ----------------------------------------------------------
MG="$INTERIM/mg.osm.pbf"
if [[ $FORCAR -eq 1 || ! -f "$MG" || "$PBF" -nt "$MG" ]]; then
  echo "==> Recortando MG + 30 km (bbox $BBOX)"
  docker run --rm --network host -u "$(id -u):$(id -g)" \
    -v "$RAW:/in:ro" -v "$INTERIM:/out" \
    "$IMG_OSMIUM" extract --bbox "$BBOX" --strategy=smart --overwrite \
    -o /out/mg.osm.pbf "/in/$ARQ_PBF"
else
  echo "==> Recorte já existe: $MG"
fi

# --- 3. Tiles do Valhalla ------------------------------------------------
if [[ $FORCAR -eq 1 || ! -f "$TILES/valhalla_tiles.tar" || "$MG" -nt "$TILES/valhalla_tiles.tar" ]]; then
  echo "==> Gerando tiles do Valhalla (limite $MEMORIA, $THREADS threads)"
  # Os arquivos gerados pertencem ao root (container): limpa de dentro dele.
  docker run --rm -v "$TILES:/custom_files" --entrypoint sh "$IMG_VALHALLA" -c \
    'find /custom_files -mindepth 1 -delete'
  cp "$MG" "$TILES/mg.osm.pbf"   # o script oficial só enxerga .pbf dentro de /custom_files
  docker run --rm --network host --memory "$MEMORIA" --memory-swap "$MEMORIA" \
    -v "$TILES:/custom_files" \
    -e server_threads="$THREADS" -e serve_tiles=False \
    -e build_tar=True -e build_admins=True -e build_time_zones=False \
    -e force_rebuild=True \
    "$IMG_VALHALLA" build_tiles
  docker run --rm -v "$TILES:/custom_files" --entrypoint sh "$IMG_VALHALLA" -c \
    'rm -rf /custom_files/mg.osm.pbf /custom_files/valhalla_tiles'   # o servidor usa só o .tar
else
  echo "==> Tiles já gerados: $TILES/valhalla_tiles.tar"
fi

echo "==> Pronto. Suba com: pnpm rotas:up"
