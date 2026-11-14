# 0007 — Deploy gratuito: Vercel (site + API) e Neon (PostGIS), sem rotas desenhadas

Status: Aceito. Substitui o [0006](0006-deploy.md) como deploy padrão; o compose com Caddy continua válido para quem tiver uma VPS.

## Contexto

O projeto é de IC e precisa ficar público sem custo. O ADR 0006 pressupõe uma máquina sempre ligada. Nenhum plano gratuito oferece os ~2 GB de RAM permanentes que o Valhalla (ADR 0005) exige. O resto da aplicação cabe em planos gratuitos: o banco tem ~125 MB, os tiles ~55 MB, e a API e o SSR são stateless.

**Decisão do autor:** publicar com Vercel + Neon, sem a rota desenhada no mapa em produção. "Como chegar" passa a oferecer só os links externos (app de mapas do aparelho, Google Maps, OpenStreetMap).

## Decisão

| Peça | Onde | Como |
|---|---|---|
| Site (Angular, estáticos + PWA) | CDN da Vercel | `static/` do Build Output API |
| Tiles PMTiles | CDN da Vercel | arquivos estáticos em `/tiles/*.pmtiles` (HTTP Range) |
| SSR (metas Open Graph) | função Node da Vercel (`gru1`) | `ssr.func`: `server.mjs` do Angular + adaptador `vercel.mjs` |
| API NestJS | função Node da Vercel (`gru1`) | `api.func`: saída do `tsc` empacotada num arquivo com esbuild (`apps/api/src/vercel.ts`) |
| PostGIS | Neon (`aws-sa-east-1`, Postgres 17, PostGIS 3.6) | `DATABASE_URL` = pooler; `DATABASE_URL_UNPOOLED` = conexão direta, usada só para o restore |
| Valhalla | — | fora; `GET /api/meta` devolve `rotas: false` quando `VALHALLA_URL` não está definida e o front esconde a rota desenhada |

- **Build Output API v3, montado localmente** (`infra/vercel/build.mjs`) e enviado com `vercel deploy --prebuilt`. Os tiles vêm do ETL (`data/`, não versionado), por isso não há build no Git da Vercel.
- **Rotas da CDN:** primeiro os arquivos estáticos, depois `/api/*` vai para a função da API e o resto para o SSR. Assets com hash são `immutable`; `ngsw.json`, o worker e o manifest são `no-cache`.
- **SSR:** o `HttpClient` do servidor resolve `/api/...` contra o host da própria requisição, ou seja, a mesma implantação. O adaptador libera os hosts da Vercel na proteção contra SSRF do Angular (`NG_ALLOWED_HOSTS`: domínio de produção, `VERCEL_URL` e `*.vercel.app`).
- **Pool do Postgres** com `PG_POOL_MAX=3` por instância e listener de erro: o Neon encerra conexões ociosas.
- **Banco:** `pg_dump` do PostGIS local e `pg_restore --clean` no Neon (`infra/vercel/publicar-banco.sh`). O ETL continua rodando contra o banco local (ADR 0002).

## Operação

```
pnpm exec vercel login             # uma vez
pnpm banco:publicar                # após cada carga do ETL: copia o banco local para o Neon
pnpm deploy:vercel                 # build + deploy de produção (--preview para pré-visualização)
```

Segredos ficam em `.env.vercel` (gerado a partir do `neon init`, ignorado pelo Git). O deploy grava o `DATABASE_URL` nas variáveis do projeto da Vercel sem exibi-lo.

## Consequências

- Custo zero, dentro dos planos Hobby (Vercel, uso não comercial) e Free (Neon: 0,5 GB, compute que hiberna).
- Primeira requisição após inatividade é mais lenta: a função sai do estado frio e o Neon acorda o compute (~1 s).
- Sem rota desenhada nem instruções passo a passo em produção. Para voltar, basta subir um Valhalla acessível (VPS, ADR 0005/0006) e definir `VALHALLA_URL` na Vercel; o front reativa sozinho via `meta.rotas`.
- Deploy depende desta máquina (tiles locais). Automatizar via CI exigiria publicar os tiles num storage (Vercel Blob ou R2).
