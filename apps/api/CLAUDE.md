# apps/api — NestJS 12

- NestJS 12 é mais novo que o conhecimento de treino comum. Documentação indexada: https://docs.nestjs.com/llms.txt (uma página markdown por capítulo). Confira lá antes de assumir APIs.
- ESM puro: imports relativos terminam em `.js`; não existe `__dirname` (use `import.meta.dirname`).
- Testes em Vitest (`vi.fn()`, não `jest.fn()`). Unitários: `pnpm test`; e2e: `pnpm test:e2e`.
- Validação: `StandardSchemaValidationPipe` com Zod/Valibot funciona sem decorators; `class-validator` também.
- OpenAPI via `@nestjs/swagger` (será a fonte do cliente tipado do front).
- Lint: oxlint (`pnpm lint`).

## API REST (Fase 2)

Contrato: `packages/domain/src/api.ts` (importe só **tipos**: `import type {...} from '@webgissus/domain'`; categorias em runtime via `@webgissus/domain/categorias.json`). Swagger em `/api/docs`; tiles estáticos (HTTP Range) em `/tiles`; health em `/api/health`.

- Estrutura: um módulo por assunto (`meta`, `regioes`, `municipios`, `estabelecimentos`, `rota`, `database`), SQL explícito e parametrizado em `*.repository.ts`; validação em `common/params.ts` (funções puras testadas) + `common/pipes.ts`. Sem ORM.
- Injeção sempre com `@Inject(Classe)` explícito: o Vitest não emite `emitDecoratorMetadata`.
- Configuração HTTP (prefixo `api`, CORS, tiles, Swagger) em `src/setup.ts`, usada por `main.ts` e pelos e2e.
- "Perto de mim" (`/estabelecimentos/proximos`) só considera `coord_ok = true` (ADR 0003).

Comandos (a partir de `apps/api`, ou `pnpm --filter api <cmd>`):

```
pnpm test            # unitários (src/**/*.spec.ts)
pnpm test:e2e        # e2e contra PostGIS real (precisa de `pnpm db:up` na raiz)
pnpm typecheck | lint | build
pnpm start:dev       # http://localhost:3000/api
```

Os e2e recriam o banco **separado** `webgissus_test` (esquema `infra/db/001_schema.sql` + `test/fixtures/seed.sql`); nunca tocam `webgissus`, que é do ETL. Override: `TEST_ADMIN_URL`, `TEST_DATABASE_URL`.

Variáveis de ambiente (lidas de `.env` em `apps/api` ou na raiz):

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `postgres://webgissus:webgissus_dev@127.0.0.1:5432/webgissus` | PostGIS |
| `PORT` | `3000` | porta HTTP |
| `CORS_ORIGIN` | `http://localhost:4200` | origens liberadas (lista separada por vírgula) |
| `TILES_DIR` | `<repo>/data/processed/tiles` | diretório servido em `/tiles` |
| `VALHALLA_URL` | (vazio) | base do Valhalla; sem ela `/api/rota` → 503 e `/api/meta` traz `rotas: false` |
| `PG_POOL_MAX` | `10` | conexões por instância (3 na Vercel) |

Na Vercel (ADR 0007) a entrada é `src/vercel.ts`, empacotada por `infra/vercel/build.mjs`; sem tiles nem Swagger.
