import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { ADMIN_URL, TEST_DATABASE_URL, TEST_DB } from './banco.js';

/** Recria webgissus_test, aplica o esquema do ETL e o seed sintético. */
export default async function setup() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.end();
  }

  const cliente = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await cliente.connect();
  try {
    const schema = await readFile(resolve(import.meta.dirname, '../../../infra/db/001_schema.sql'), 'utf8');
    const seed = await readFile(resolve(import.meta.dirname, 'fixtures/seed.sql'), 'utf8');
    await cliente.query(schema);
    await cliente.query(seed);
  } finally {
    await cliente.end();
  }
}
