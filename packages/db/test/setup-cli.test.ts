import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dropSchemas, resolveSchemas } from '../src/index.ts';
import type { SchemaNames } from '../src/index.ts';
import { createTestSchema } from '../src/testing.ts';
import type { TestSchema } from '../src/testing.ts';

const run = promisify(execFile);
const CLI_CWD = new URL('..', import.meta.url);

/**
 * Spawns the real `db:setup` and `db:seed` CLIs against the real database.
 *
 * `db:setup` ends with the Storybook mirror step, which always uses the fixed prefix `sb_`
 * (DB_SCHEMA_PREFIX ignored). The test must not touch the developer's real `sb_*`, so it sets
 * TEAMBOARD_STORYBOOK_PREFIX to a throwaway `t<hex>_sb_` prefix, as the seed-storybook test does,
 * and checks that the real `sb_*` and the unprefixed schemas have the same table list before and after.
 */
describe('db:setup CLI seeds the Storybook mirror (real Postgres, spawned process)', () => {
  let t: TestSchema; // stands in for "the normal schemas", selected by DB_SCHEMA_PREFIX
  let mirror: SchemaNames;
  let seedOnlyMirror: SchemaNames;

  beforeAll(async () => {
    t = await createTestSchema({ migrate: false });
    mirror = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`);
    seedOnlyMirror = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`);
  });
  afterAll(async () => {
    try {
      await dropSchemas(t.pool, mirror);
      await dropSchemas(t.pool, seedOnlyMirror);
    } finally {
      await t.drop();
    }
  });

  const cli = (script: string, sb: SchemaNames) =>
    run(process.execPath, ['--import', 'tsx', `src/cli/${script}.ts`], {
      cwd: CLI_CWD,
      env: { ...process.env, DB_SCHEMA_PREFIX: t.prefix, TEAMBOARD_STORYBOOK_PREFIX: sb.prefix },
    });

  const count = async (sql: string) => (await t.pool.query<{ n: number }>(sql)).rows[0]!.n;
  const schemaExists = async (raw: string) =>
    (await count(`select count(*)::int n from pg_namespace where nspname = '${raw}'`)) === 1;

  async function realSchemas() {
    const { rows } = await t.pool.query<{ t: string }>(
      `select table_schema || '.' || table_name t from information_schema.tables
        where table_schema in ('app', 'config', 'mocks', 'sb_app', 'sb_config', 'sb_mocks')
        order by 1`,
    );
    return rows.map((r) => r.t);
  }

  it('keeps the existing steps and appends the mirror seed', async () => {
    const before = await realSchemas();
    const { stdout } = await cli('setup', mirror);
    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^migrate: applied /);
    expect(lines[1]).toMatch(
      /^seed: \d+ flags, \d+ settings, \d+ fixtures, starter board created$/,
    );
    expect(lines[2]).toBe(`storybook: ${mirror.raw.app} 6 scenarios (6 created)`);

    // DB_SCHEMA_PREFIX schemas: the normal setup result, no mirror inside them.
    expect(await count(`select count(*)::int n from ${t.schemas.app}.boards`)).toBe(1);
    expect(await count(`select count(*)::int n from ${t.schemas.mocks}.fixtures`)).toBe(6);
    // The mirror: six scenario boards, every board and column name marked as mock.
    expect(await count(`select count(*)::int n from ${mirror.app}.boards`)).toBe(6);
    expect(
      await count(`select count(*)::int n from ${mirror.app}.boards where name !~ 'mock'`),
    ).toBe(0);
    expect(
      await count(`select count(*)::int n from ${mirror.app}.columns where name !~ 'mock'`),
    ).toBe(0);
    expect(await count(`select count(*)::int n from ${mirror.config}.settings`)).toBeGreaterThan(6);
    // The real sb_* and unprefixed schemas were not touched.
    expect(await realSchemas()).toEqual(before);
  });

  it('is idempotent: a second run creates nothing and keeps edits', async () => {
    await t.pool.query(
      `update ${mirror.app}.cards set title = 'EDITED' where id = (select min(id) from ${mirror.app}.cards)`,
    );
    const counts = async () => [
      await count(`select count(*)::int n from ${mirror.app}.boards`),
      await count(`select count(*)::int n from ${mirror.app}.cards`),
      await count(`select count(*)::int n from ${t.schemas.app}.boards`),
    ];
    const before = await counts();
    const { stdout } = await cli('setup', mirror);
    const lines = stdout.trim().split('\n');
    expect(lines[0]).toMatch(/^migrate: up to date \(\d+ applied\)$/);
    expect(lines[2]).toBe(`storybook: ${mirror.raw.app} 6 scenarios (0 created)`);
    expect(await counts()).toEqual(before);
    expect(
      await count(`select count(*)::int n from ${mirror.app}.cards where title = 'EDITED'`),
    ).toBe(1);
  });

  it('db:seed alone does not create the mirror', async () => {
    const { stdout } = await cli('seed', seedOnlyMirror);
    expect(stdout).not.toContain('storybook');
    expect(await schemaExists(seedOnlyMirror.raw.app)).toBe(false);
  });
});
