#!/usr/bin/env bash
# Roda o pytest dos pipelines dentro do container.
# Ex.: pipelines/test.sh -k classificacao
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=webgissus-pipelines
docker build -q --network host -t "$IMAGE" pipelines >/dev/null
docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/pipelines:/repo/pipelines:ro" \
  -v "$PWD/packages:/repo/packages:ro" \
  -w /repo/pipelines \
  "$IMAGE" python -m pytest "$@"
