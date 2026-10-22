import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  boardPayloadSchema,
  createPool,
  dropSchemas,
  liveResponse,
  resolveSchemas,
  runMigrations,
  seedStorybook,
} from '../src/index.ts';
import type { Pool, SchemaNames } from '../src/index.ts';

/**
 * The answer behind the dev-server endpoint `/__fixtures/:name[/version]` (the same function
 * the Vite middleware calls), against real Postgres and a throwaway `t<hex>_sb_` prefix. The real
 * sb_* rows are never touched.
 */
describe('liveResponse (real Postgres, throwaway prefix)', () => {
  let pool: Pool;
  let sb: SchemaNames;
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    pool = createPool({ max: 3 });
    sb = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`);
    env = { TEAMBOARD_STORYBOOK_PREFIX: sb.prefix };
    await runMigrations(pool, sb);
    await seedStorybook(pool, sb);
  });
  afterAll(async () => {
    try {
      await dropSchemas(pool, sb);
    } finally {
      await pool.end();
    }
  });

  const get = (path: string) => liveResponse(path, () => pool, env);

  it('serves the scenario with its version and schema in headers', async () => {
    const res = await get('/__fixtures/typical');
    expect(res?.status).toBe(200);
    expect(res?.headers['X-Live-Schema']).toBe(sb.raw.app);
    expect(boardPayloadSchema.safeParse(res?.body).success).toBe(true);
    const v = await get('/__fixtures/typical/version');
    expect(v?.body).toEqual({ version: res?.headers['X-Live-Version'] });
  });

  it('reflects an UPDATE of a card title, and /version changes', async () => {
    const first = (await get('/__fixtures/typical'))!;
    const v1 = (await get('/__fixtures/typical/version'))!.body as { version: string };
    const body1 = first.body as { columns: { cards: { id: number }[] }[] };
    const card = body1.columns.flatMap((c) => c.cards)[0]!;
    await pool.query(`update ${sb.app}.cards set title = 'Changed by SQL' where id = $1`, [
      card.id,
    ]);
    const second = (await get('/__fixtures/typical'))!;
    const body2 = second.body as { columns: { cards: { id: number; title: string }[] }[] };
    expect(body2.columns.flatMap((c) => c.cards).find((c) => c.id === card.id)?.title).toBe(
      'Changed by SQL',
    );
    const v2 = (await get('/__fixtures/typical/version'))!.body as { version: string };
    expect(v2.version).not.toBe(v1.version);
    expect(second.headers['X-Live-Version']).toBe(v2.version);
  });

  it('answers a clear error: 404 unknown scenario, 503 with the seed hint when not seeded', async () => {
    const unknown = await get('/__fixtures/nope');
    expect(unknown?.status).toBe(404);
    expect((unknown?.body as { error: string }).error).toContain('nope');

    await dropSchemas(pool, sb);
    const gone = await get('/__fixtures/typical');
    expect(gone?.status).toBe(503);
    expect((gone?.body as { error: string }).error).toContain('npm run db:setup');
    expect((await get('/__fixtures/typical/version'))?.status).toBe(503);
    await runMigrations(pool, sb);
    await seedStorybook(pool, sb);
  });

  it('rejects a prefix that is not a Storybook test prefix, and ignores other paths', async () => {
    const bad = await liveResponse('/__fixtures/typical', () => pool, {
      TEAMBOARD_STORYBOOK_PREFIX: 'app_',
    });
    expect(bad?.status).toBe(500);
    expect(await get('/__fixtures')).toBeUndefined();
  });
});
