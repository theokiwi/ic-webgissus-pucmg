#!/usr/bin/env bash
# Copia o banco local (já carregado pelo ETL) para o Neon. Ver ADR 0007.
#
#   infra/vercel/publicar-banco.sh
#
# Lê DATABASE_URL_UNPOOLED de .env.vercel (conexão direta: o pooler do Neon não aceita pg_restore).
# Substitui as tabelas do destino (--clean). Rode depois de cada carga mensal do ETL.
# A contagem de acessos (acesso_diario, ADR 0009) é da produção: fica fora do dump e só é criada se faltar.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
ARQ_ENV="$RAIZ/.env.vercel"
CONTAINER="${CONTAINER_DB:-webgissus-db-1}"
IMAGEM="postgis/postgis:17-3.6"

[[ -f "$ARQ_ENV" ]] || { echo "Falta $ARQ_ENV (rode 'neon init' ou crie com DATABASE_URL e DATABASE_URL_UNPOOLED)." >&2; exit 1; }
DESTINO="$(grep -E '^DATABASE_URL_UNPOOLED=' "$ARQ_ENV" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"
[[ -n "$DESTINO" ]] || { echo "DATABASE_URL_UNPOOLED vazio em $ARQ_ENV." >&2; exit 1; }
export DESTINO

docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true \
  || { echo "O PostGIS local ($CONTAINER) não está rodando: pnpm db:up" >&2; exit 1; }

echo "▸ dump do banco local → restore no Neon (a URL não é exibida)"
# Sem --exit-on-error: avisos de COMMENT/OWNER em extensões são esperados num banco gerenciado.
docker exec "$CONTAINER" pg_dump -U webgissus -d webgissus -Fc --no-owner --no-privileges --exclude-table=acesso_diario \
  | docker run -i --rm --network host -e DESTINO "$IMAGEM" \
      sh -c 'pg_restore --no-owner --no-privileges --no-comments --clean --if-exists -d "$DESTINO"' \
  || echo "(pg_restore terminou com avisos; conferindo o resultado abaixo)"

echo "▸ tabela de acessos (não é sobrescrita)"
docker run -i --rm --network host -e DESTINO "$IMAGEM" sh -c 'psql "$DESTINO" -v ON_ERROR_STOP=1 -q' < "$RAIZ/infra/db/002_acessos.sql"

echo "▸ conferência no Neon"
docker run --rm --network host -e DESTINO "$IMAGEM" sh -c 'psql "$DESTINO" -Atc "
  select '\''municipios='\'' || count(*) from municipio
  union all select '\''estabelecimentos='\'' || count(*) from estabelecimento
  union all select '\''competencia='\'' || max(competencia) from carga
  union all select '\''acessos='\'' || coalesce(sum(n), 0) from acesso_diario
  union all select '\''postgis='\'' || postgis_lib_version();"'
