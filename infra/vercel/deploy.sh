#!/usr/bin/env bash
# Publica o site na Vercel a partir desta máquina. Ver ADR 0007.
#
#   pnpm deploy:vercel            # build + deploy de produção
#   pnpm deploy:vercel --preview  # build + deploy de pré-visualização
#
# Pré-requisitos: `pnpm exec vercel login` (uma vez), .env.vercel com DATABASE_URL (pooler do Neon)
# e os tiles em data/processed/tiles. O banco é publicado à parte: infra/vercel/publicar-banco.sh.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RAIZ"
PROJETO="${VERCEL_PROJETO:-webgissus-mg}"
ALVO="production"
[[ "${1:-}" == "--preview" ]] && ALVO="preview"
vercel() { pnpm exec vercel "$@"; }

[[ -f .env.vercel ]] || { echo "Falta .env.vercel (DATABASE_URL do Neon)." >&2; exit 1; }
URL_BANCO="$(grep -E '^DATABASE_URL=' .env.vercel | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"
[[ -n "$URL_BANCO" ]] || { echo "DATABASE_URL vazio em .env.vercel." >&2; exit 1; }
# node-postgres: 'require' hoje equivale a 'verify-full' e emite aviso; deixa explícito.
URL_BANCO="${URL_BANCO/sslmode=require/sslmode=verify-full}"

vercel whoami >/dev/null 2>&1 || { echo "Faça login antes: pnpm exec vercel login" >&2; exit 1; }

if [[ ! -f .vercel/project.json ]]; then
  echo "▸ vinculando ao projeto Vercel '$PROJETO'"
  vercel project add "$PROJETO" >/dev/null 2>&1 || true # já existe: segue
  vercel link --yes --project "$PROJETO" >/dev/null
fi

echo "▸ DATABASE_URL ($ALVO) — valor não exibido"
vercel env rm DATABASE_URL "$ALVO" --yes >/dev/null 2>&1 || true
printf '%s' "$URL_BANCO" | vercel env add DATABASE_URL "$ALVO" >/dev/null

node infra/vercel/build.mjs

echo "▸ enviando para a Vercel"
if [[ "$ALVO" == "production" ]]; then
  vercel deploy --prebuilt --prod
else
  vercel deploy --prebuilt
fi
