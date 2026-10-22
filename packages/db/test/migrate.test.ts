import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  listMigrationFiles,
  renderSql,
  resolveSchemas,
  restoreFixturesTable,
  runMigrations,
} from '../src/index.ts';
import { createTestSchema } from '../src/testing.ts';
import type { TestSchema } from '../src/testing.ts';

describe('migrations', () => {
  let t: TestSchema;

  beforeAll(async () => {
    t = await createTestSchema({ migrate: false });
  });
  afterAll(async () => {
    await t.drop();
  });

  it('applies every file once and is idempotent', async () => {
    const files = await listMigrationFiles();
    expect(files.length).toBeGreaterThan(0);

    const first = await runMigrations(t.pool, t.schemas);
    expect(first.applied).toEqual(files.map((f) => f.name));
    expect(first.skipped).toEqual([]);

    const second = await runMigrations(t.pool, t.schemas);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(files.map((f) => f.name));

    const { rows } = await t.pool.query(`select name from ${t.schemas.app}.migrations`);
    expect(rows).toHaveLength(files.length);
  });

  it('creates the tables in the two prefixed schemas and drops the legacy mocks schema', async () => {
    const { rows } = await t.pool.query<{ table_schema: string; table_name: string }>(
      `select table_schema, table_name from information_schema.tables
        where table_schema = any($1) order by 1, 2`,
      [Object.values(t.schemas.raw)],
    );
    const names = rows.map((r) => `${r.table_schema.slice(t.prefix.length)}.${r.table_name}`);
    expect(names).toEqual([
      'app.boards',
      'app.cards',
      'app.columns',
      'app.comments',
      'app.migrations',
      'app.users',
      'config.feature_flags',
      'config.settings',
    ]);
  });

  it('is safe to run concurrently', async () => {
    const other = await createTestSchema({ migrate: false });
    try {
      const results = await Promise.all([
        runMigrations(other.pool, other.schemas),
        runMigrations(other.pool, other.schemas),
        runMigrations(other.pool, other.schemas),
      ]);
      const appliedCount = results.reduce((n, r) => n + r.applied.length, 0);
      expect(appliedCount).toBe((await listMigrationFiles()).length);
    } finally {
      await other.drop();
    }
  });

  it('never touches the default schemas when a prefix is used', async () => {
    expect(t.schemas.raw.app).toBe(`${t.prefix}app`);
    expect(t.prefix).not.toBe('');
  });
});

describe('002_drop_mocks', () => {
  const exists = async (t: TestSchema, raw: string) =>
    (
      await t.pool.query<{ n: number }>(
        'select count(*)::int n from pg_namespace where nspname = $1',
        [raw],
      )
    ).rows[0]!.n === 1;

  it('drops the legacy mocks schema and never brings it back', async () => {
    const t = await createTestSchema({ migrate: false });
    try {
      // An older database: only 001 applied, with fixtures inside mocks.
      await t.pool.query(`create schema ${t.schemas.mocks}`);
      await runMigrations(t.pool, t.schemas);
      expect(await exists(t, t.schemas.raw.mocks)).toBe(false);
      expect((await runMigrations(t.pool, t.schemas)).applied).toEqual([]);
      expect(await exists(t, t.schemas.raw.mocks)).toBe(false);
    } finally {
      await t.drop();
    }
  });

  it('upgrades a database that still holds mocks.fixtures, keeping app data', async () => {
    const t = await createTestSchema({ migrate: false });
    try {
      const files = await listMigrationFiles();
      const first = files.find((f) => f.name === '001_init.sql')!;
      // Simulate the old code: schemas, 001 only, a fixture row and an app row.
      for (const s of [t.schemas.app, t.schemas.config, t.schemas.mocks]) {
        await t.pool.query(`create schema if not exists ${s}`);
      }
      await t.pool.query(renderSql(first.sql, t.schemas));
      await t.pool.query(
        `create table ${t.schemas.app}.migrations (name text primary key, applied_at timestamptz not null default now())`,
      );
      await t.pool.query(`insert into ${t.schemas.app}.migrations (name) values ('001_init.sql')`);
      await t.pool.query(
        `insert into ${t.schemas.mocks}.fixtures (name, data) values ('typical', '{}')`,
      );
      await t.pool.query(
        `insert into ${t.schemas.app}.users (name, initials, color) values ('Ada', 'A', '#fff')`,
      );

      const res = await runMigrations(t.pool, t.schemas);
      expect(res.applied).toEqual(files.map((f) => f.name).filter((n) => n !== '001_init.sql'));
      expect(await exists(t, t.schemas.raw.mocks)).toBe(false);
      const { rows } = await t.pool.query(`select name from ${t.schemas.app}.users`);
      expect(rows).toEqual([{ name: 'Ada' }]);
    } finally {
      await t.drop();
    }
  });

  it('restoreFixturesTable puts back an empty table and forgets 002, then 002 can run again', async () => {
    const t = await createTestSchema();
    try {
      await t.pool.query(
        `insert into ${t.schemas.app}.users (name, initials, color) values ('Ada', 'A', '#fff')`,
      );
      await restoreFixturesTable(t.pool, t.schemas);
      const fx = await t.pool.query(`select count(*)::int n from ${t.schemas.mocks}.fixtures`);
      expect(fx.rows[0].n).toBe(0);
      const { rows } = await t.pool.query(`select name from ${t.schemas.app}.migrations`);
      expect(rows.map((r) => r.name)).not.toContain('002_drop_mocks.sql');

      // Safe to repeat.
      await restoreFixturesTable(t.pool, t.schemas);

      const again = await runMigrations(t.pool, t.schemas);
      expect(again.applied).toEqual(['002_drop_mocks.sql']);
      expect(await exists(t, t.schemas.raw.mocks)).toBe(false);
      expect((await t.pool.query(`select name from ${t.schemas.app}.users`)).rows).toHaveLength(1);
    } finally {
      await t.drop();
    }
  });
});

describe('schema names', () => {
  it('defaults to no prefix and quotes names', () => {
    const s = resolveSchemas('');
    expect(s.app).toBe('"app"');
    expect(s.config).toBe('"config"');
    expect(s.mocks).toBe('"mocks"');
  });

  it('rejects unsafe prefixes', () => {
    expect(() => resolveSchemas('x"; drop schema public; --')).toThrow(/Invalid DB_SCHEMA_PREFIX/);
    expect(() => resolveSchemas('Upper_')).toThrow();
    expect(() => resolveSchemas('1abc_')).toThrow();
  });

  it('renders templates', () => {
    const s = resolveSchemas('p_');
    expect(renderSql('create table {{app}}.a(); {{config}}.b {{mocks}}.c', s)).toBe(
      'create table "p_app".a(); "p_config".b "p_mocks".c',
    );
  });
});
