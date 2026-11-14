/** Banco SEPARADO dos testes e2e; o banco `webgissus` pertence ao ETL e nunca é tocado. */
export const ADMIN_URL =
  process.env.TEST_ADMIN_URL ?? 'postgres://webgissus:webgissus_dev@127.0.0.1:5432/postgres';
export const TEST_DB = 'webgissus_test';
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgres://webgissus:webgissus_dev@127.0.0.1:5432/${TEST_DB}`;
