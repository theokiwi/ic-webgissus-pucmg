#!/usr/bin/env bash
# Executa um script Python dos pipelines dentro do container.
# Ex.: pipelines/run.sh spike/explorar_cnes.py
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=webgissus-pipelines
# --network host: no NixOS o DNS do host (127.0.0.53) não chega à rede bridge do Docker
docker build -q --network host -t "$IMAGE" pipelines >/dev/null
docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  --memory 3g \
  -v "$PWD/data:/repo/data" \
  -v "$PWD/docs:/repo/docs" \
  -v "$PWD/pipelines:/repo/pipelines:ro" \
  -v "$PWD/packages:/repo/packages:ro" \
  -v "$PWD/infra:/repo/infra:ro" \
  "$IMAGE" python -I "pipelines/$1" "${@:2}"
