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

/** The migration that still needs the legacy `mocks` schema to exist (dropped by 002_drop_mocks.sql). */
const LEGACY_MOCKS_CREATED_BY = '001_init.sql';
export const DROP_MOCKS_MIGRATION = '002_drop_mocks.sql';

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
 * Creates the app and config schemas and applies every migration file that is not yet recorded in
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
    for (const schema of [schemas.app, schemas.config]) {
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
    // Legacy: 001 puts a table in {{mocks}} and 002 drops the schema again. Create it only for a
    // fresh database, so an up-to-date one never gets an empty `mocks` back.
    if (!done.has(LEGACY_MOCKS_CREATED_BY)) {
      await client.query(`create schema if not exists ${schemas.mocks}`);
    }
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

/** Drops the schemas (cascade; `mocks` only exists on databases older than 002).  Used by db:reset and by tests for cleanup. */
export async function dropSchemas(pool: Pool, schemas: SchemaNames = resolveSchemas()) {
  await pool.query(
    `drop schema if exists ${schemas.app}, ${schemas.config}, ${schemas.mocks} cascade`,
  );
}

/**
 * Going back to the code that still reads `mocks.fixtures` (tag `fixtures-main`): recreates the
 * empty table and forgets that 002 ran, so that code's `db:setup` can fill it again. Run
 * `npm run db:restore-fixtures` on this branch before checking out the old code. App data is
 * not touched. Running the new code later re-applies 002 and drops `mocks` again.
 */
export async function restoreFixturesTable(pool: Pool, schemas: SchemaNames = resolveSchemas()) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [
      `teamboard:migrate:${schemas.raw.app}`,
    ]);
    await client.query(`create schema if not exists ${schemas.mocks}`);
    await client.query(
      `create table if not exists ${schemas.mocks}.fixtures (
         name        text primary key,
         description text not null default '',
         data        jsonb not null
       )`,
    );
    await client.query(`delete from ${schemas.app}.migrations where name = $1`, [
      DROP_MOCKS_MIGRATION,
    ]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
