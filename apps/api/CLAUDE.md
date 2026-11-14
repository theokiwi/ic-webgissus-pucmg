# apps/api — NestJS 12

- NestJS 12 é mais novo que o conhecimento de treino comum. Documentação indexada: https://docs.nestjs.com/llms.txt (uma página markdown por capítulo). Confira lá antes de assumir APIs.
- ESM puro: imports relativos terminam em `.js`; não existe `__dirname` (use `import.meta.dirname`).
- Testes em Vitest (`vi.fn()`, não `jest.fn()`). Unitários: `pnpm test`; e2e: `pnpm test:e2e`.
- Validação: `StandardSchemaValidationPipe` com Zod/Valibot funciona sem decorators; `class-validator` também.
- OpenAPI via `@nestjs/swagger` (será a fonte do cliente tipado do front).
- Lint: oxlint (`pnpm lint`).
