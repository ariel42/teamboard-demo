import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from './pool.ts';
import { resolveSchemas } from './schema-names.ts';
import type { SchemaNames } from './schema-names.ts';

export const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url);

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface MigrateResult {
  applied: string[];
  skipped: string[];
}

/** Replaces {{app}}, {{config}} and {{mocks}} with the quoted schema names. */
export function renderSql(sql: string, schemas: SchemaNames): string {
  return sql.replace(/\{\{(app|config|mocks)\}\}/g, (_m, key: 'app' | 'config' | 'mocks') => {
    return schemas[key];
  });
}

export async function listMigrationFiles(): Promise<MigrationFile[]> {
  const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith('.sql')).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(new URL(name, MIGRATIONS_DIR), 'utf8'),
    })),
  );
}

/**
 * Creates the three schemas and applies every migration file that is not yet recorded in
 * `<prefix>app.migrations`. Runs in one transaction under an advisory lock, so concurrent runs
 * (two terminals, parallel test files) are safe and a failing migration leaves nothing behind.
 */
export async function runMigrations(
  pool: Pool,
  schemas: SchemaNames = resolveSchemas(),
): Promise<MigrateResult> {
  const files = await listMigrationFiles();
  const client = await pool.connect();
  const result: MigrateResult = { applied: [], skipped: [] };
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [
      `teamboard:migrate:${schemas.raw.app}`,
    ]);
    for (const schema of [schemas.app, schemas.config, schemas.mocks]) {
      await client.query(`create schema if not exists ${schema}`);
    }
    await client.query(
      `create table if not exists ${schemas.app}.migrations (
         name       text primary key,
         applied_at timestamptz not null default now()
       )`,
    );
    const { rows } = await client.query<{ name: string }>(
      `select name from ${schemas.app}.migrations`,
    );
    const done = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (done.has(file.name)) {
        result.skipped.push(file.name);
        continue;
      }
      await client.query(renderSql(file.sql, schemas));
      await client.query(`insert into ${schemas.app}.migrations (name) values ($1)`, [file.name]);
      result.applied.push(file.name);
    }
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Drops all three schemas (cascade). Used by db:reset and by tests for cleanup. */
export async function dropSchemas(pool: Pool, schemas: SchemaNames = resolveSchemas()) {
  await pool.query(
    `drop schema if exists ${schemas.app}, ${schemas.config}, ${schemas.mocks} cascade`,
  );
}
