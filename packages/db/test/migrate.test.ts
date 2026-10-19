import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listMigrationFiles, renderSql, resolveSchemas, runMigrations } from '../src/index.ts';
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

  it('creates the tables in the three prefixed schemas', async () => {
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
      'mocks.fixtures',
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
