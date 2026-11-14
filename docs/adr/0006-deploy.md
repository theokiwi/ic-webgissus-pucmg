# 0006 — Deploy: Docker Compose + Caddy em VPS ou servidor da universidade

Status: Substituído por [0007](0007-deploy-vercel-neon.md) como deploy padrão (continua válido para VPS)

## Contexto

O MVP precisa de HTTPS (PWA, geolocalização e Web Share exigem, ADR 0001), de SSR para as tags Open Graph e de uma API sobre PostGIS com Valhalla (ADR 0005) e tiles PMTiles. O custo deve ser previsível e a operação, simples para uma equipe de IC.

## Decisão

Recomendado: **uma máquina (VPS ou servidor da universidade) com Docker Compose** (`infra/docker-compose.prod.yml`) e **Caddy** na frente, que obtém e renova certificados Let's Encrypt sozinho.

| Serviço | Imagem | Observações |
|---|---|---|
| `caddy` | `caddy:2` | portas 80/443; `reverse_proxy web:4000`; sem access log (a query de "perto de mim" e rotas leva a posição do usuário) |
| `web` | `apps/web/Dockerfile` | Angular SSR em Node; **mesma origem**: o `server.ts` faz proxy de `/api` e `/tiles` para `API_URL` (Range e status preservados) |
| `api` | `apps/api/Dockerfile` | NestJS; só na rede interna; `CORS_ORIGIN` = site |
| `db` | `postgis/postgis:17-3.6` | volume `pgdata`; schema de `infra/db` |
| `valhalla` | `valhalla-scripted:3.9.1` | tiles em `data/processed/valhalla` (gerados por `pnpm rotas:preparar`) |

- Variáveis: `DOMINIO`, `POSTGRES_PASSWORD` (compose); `PUBLIC_URL` (URLs absolutas de og:url, og:image e canonical), `API_URL` (SSR e proxy) no `web`. `PUBLIC_URL` também é argumento de build, porque `/sobre` e `/privacidade` são prerenderizadas no build.
- Imagens multi-stage com pnpm (`pnpm deploy --prod`), usuário não-root (`node`) e healthcheck. Medido: api ≈ 394 MB, web ≈ 468 MB.
- Dados (`data/processed/tiles`, `valhalla`) e a carga do banco são produzidos fora do compose (pipelines em Docker) e montados/importados no servidor; nunca vão para o git nem para a imagem.
- Service worker do PWA: `ngsw.json` e `ngsw-worker.js` saem com `Cache-Control: no-cache`; `/api` usa estratégia freshness (5 s), PMTiles de municípios e regiões usam performance; `/api/rota` e `/api/estabelecimentos/proximos` nunca são cacheados.

## Alternativas

- PaaS (Render, Fly.io, Railway): deploy mais simples, mas Valhalla (≈ 900 MB de tiles, 2 GB de RAM) e PostGIS elevam o custo e prendem a um fornecedor.
- Front estático em CDN + API separada: perde o SSR das metas Open Graph e obriga a CORS e a duas origens.
- Nginx/Traefik no lugar do Caddy: equivalentes; o Caddy foi escolhido por não exigir configuração de certificado.

## Consequências

- Requisitos mínimos estimados: 4 vCPU, 8 GB de RAM e ~10 GB de disco (Valhalla 2 GB, Postgres, tiles).
- Atualização mensal do CNES = rodar o ETL e recarregar banco e tiles; o front só precisa de novo build se o código mudar.
- Backups do volume `pgdata` ficam por conta de quem opera.
- Não foi subida uma instância de produção; o compose foi validado com `docker compose config` e as imagens de `api` e `web` foram construídas e executadas isoladamente.
