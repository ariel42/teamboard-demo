import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dropSchemas, resolveSchemas, seedAll } from '../src/index.ts';
import type { SchemaNames } from '../src/index.ts';
import { createTestSchema } from '../src/testing.ts';
import type { TestSchema } from '../src/testing.ts';

const run = promisify(execFile);
const CLI_CWD = new URL('..', import.meta.url);

/**
 * Spawns the real CLI (src/cli/seed-storybook.ts) against the real database.
 *
 * Safety: the CLI normally uses the fixed prefix `sb_`. The test must never touch the developer's
 * real `sb_*` schemas (they hold hand-edited rows), so it sets TEAMBOARD_STORYBOOK_PREFIX to a
 * throwaway `t<hex>_sb_` prefix. The test also proves the real `sb_*` and the unprefixed
 * `app`/`config`/`mocks` schemas have the same table counts and card titles before and after.
 * (A throwaway database is not an option: the dev role has no CREATEDB.)
 */
describe('db:seed-storybook CLI (real Postgres, spawned process)', () => {
  let t: TestSchema; // stands in for "the normal schemas", selected by DB_SCHEMA_PREFIX
  let mirror: SchemaNames; // the throwaway mirror the CLI is pointed at
  const realSb = ['sb_app', 'sb_config', 'sb_mocks'];
  const unprefixed = ['app', 'config', 'mocks'];

  beforeAll(async () => {
    t = await createTestSchema();
    await seedAll(t.pool, t.schemas);
    mirror = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`);
  });
  afterAll(async () => {
    try {
      await dropSchemas(t.pool, mirror);
    } finally {
      await t.drop();
    }
  });

  /** Row count of every table in the given schemas, plus an md5 of all card titles. */
  async function snapshot(schemaNames: string[]) {
    const tables = await t.pool.query<{ t: string; n: string }>(
      `select table_schema || '.' || table_name as t,
              (xpath('/row/c/text()', query_to_xml(
                 format('select count(*) c from %I.%I', table_schema, table_name),
                 false, true, '')))[1]::text as n
         from information_schema.tables
        where table_schema = any($1) and table_type = 'BASE TABLE'
        order by 1`,
      [schemaNames],
    );
    const counts = Object.fromEntries(tables.rows.map((r) => [r.t, Number(r.n)]));
    const titles: Record<string, string> = {};
    for (const schema of schemaNames) {
      if (!(`${schema}.cards` in counts)) continue;
      const { rows } = await t.pool.query<{ h: string }>(
        `select md5(coalesce(string_agg(title, '|' order by id), '')) h from "${schema}".cards`,
      );
      titles[schema] = rows[0]!.h;
    }
    return { counts, titles };
  }
  const everythingElse = () =>
    Promise.all([snapshot(Object.values(t.schemas.raw)), snapshot(unprefixed), snapshot(realSb)]);

  const cli = (args: string[] = [], env: Record<string, string> = {}) =>
    run(process.execPath, ['--import', 'tsx', 'src/cli/seed-storybook.ts', ...args], {
      cwd: CLI_CWD,
      env: {
        ...process.env,
        DB_SCHEMA_PREFIX: t.prefix,
        TEAMBOARD_STORYBOOK_PREFIX: mirror.prefix,
        ...env,
      },
    });

  const boardCount = async () =>
    (await t.pool.query<{ n: number }>(`select count(*)::int n from ${mirror.app}.boards`)).rows[0]!
      .n;

  it('seeds only the mirror prefix and ignores DB_SCHEMA_PREFIX', async () => {
    const before = await everythingElse();
    expect(Object.keys(before[0].counts).length).toBeGreaterThan(0);

    const { stdout } = await cli();
    expect(stdout.match(/\(created\)/g)).toHaveLength(6);
    expect(await boardCount()).toBe(6);

    expect(await everythingElse()).toEqual(before);
  });

  it('a second run keeps an edited card title; --reset restores it', async () => {
    const before = await everythingElse();
    await t.pool.query(
      `update ${mirror.app}.cards set title = 'EDITED' where id = (select min(id) from ${mirror.app}.cards)`,
    );

    const again = await cli();
    expect(again.stdout.match(/\(exists\)/g)).toHaveLength(6);
    const kept = await t.pool.query(`select 1 from ${mirror.app}.cards where title = 'EDITED'`);
    expect(kept.rowCount).toBe(1);

    const reset = await cli(['--reset']);
    expect(reset.stdout).toContain(`reset ${mirror.raw.app}`);
    expect(reset.stdout.match(/\(created\)/g)).toHaveLength(6);
    const gone = await t.pool.query(`select 1 from ${mirror.app}.cards where title = 'EDITED'`);
    expect(gone.rowCount).toBe(0);
    expect(await boardCount()).toBe(6);

    // Reset recreated only the mirror: the DB_SCHEMA_PREFIX schemas, the unprefixed schemas and
    // the developer's real sb_* schemas have identical counts and card titles.
    expect(await everythingElse()).toEqual(before);
  });

  it('rejects a TEAMBOARD_STORYBOOK_PREFIX that is not a test prefix', async () => {
    const before = await everythingElse();
    for (const bad of ['dev_', 'app_', t.prefix.replace(/_$/, 'x_')]) {
      await expect(cli(['--reset'], { TEAMBOARD_STORYBOOK_PREFIX: bad }), bad).rejects.toThrow();
    }
    expect(await everythingElse()).toEqual(before);
  });
});
