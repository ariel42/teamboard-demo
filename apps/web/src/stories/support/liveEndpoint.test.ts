// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  boardPayloadSchema,
  createPool,
  dropSchemas,
  resolveSchemas,
  runMigrations,
  seedStorybook,
} from '@teamboard/db';
import type { Pool, SchemaNames } from '@teamboard/db';
import { handleLive } from '../../../.storybook/fixtures-plugin';

/**
 * The dev-server endpoint `/__fixtures-live/:name[/version]` over real HTTP, real Postgres and a
 * throwaway `t<hex>_sb_` prefix (TEAMBOARD_STORYBOOK_PREFIX): the real sb_* rows are never touched.
 */
describe('/__fixtures-live endpoint (real HTTP, real Postgres, throwaway prefix)', () => {
  let pool: Pool;
  let sb: SchemaNames;
  let server: Server;
  let base: string;
  const saved = process.env.TEAMBOARD_STORYBOOK_PREFIX;

  beforeAll(async () => {
    pool = createPool({ max: 3 });
    sb = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`);
    await runMigrations(pool, sb);
    await seedStorybook(pool, sb);
    process.env.TEAMBOARD_STORYBOOK_PREFIX = sb.prefix;
    server = createServer((req, res) => {
      void handleLive(new URL(req.url ?? '/', 'http://x').pathname, res, () => pool).then(
        (handled) => {
          if (!handled) {
            res.statusCode = 404;
            res.end();
          }
        },
      );
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    if (saved === undefined) delete process.env.TEAMBOARD_STORYBOOK_PREFIX;
    else process.env.TEAMBOARD_STORYBOOK_PREFIX = saved;
    await new Promise((r) => server.close(r));
    try {
      await dropSchemas(pool, sb);
    } finally {
      await pool.end();
    }
  });

  const get = (path: string) => fetch(`${base}${path}`);

  it('serves the scenario uncached, with its version and schema in headers', async () => {
    const res = await get('/__fixtures-live/typical');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-live-schema')).toBe(sb.raw.app);
    const body = await res.json();
    expect(boardPayloadSchema.safeParse(body).success).toBe(true);
    const v = await (await get('/__fixtures-live/typical/version')).json();
    expect(v.version).toBe(res.headers.get('x-live-version'));
  });

  it('reflects an UPDATE of a card title, and /version changes', async () => {
    const first = await (await get('/__fixtures-live/typical')).json();
    const v1 = (await (await get('/__fixtures-live/typical/version')).json()).version;
    const card = first.columns.flatMap((c: { cards: { id: number }[] }) => c.cards)[0];
    await pool.query(`update ${sb.app}.cards set title = 'Changed by SQL' where id = $1`, [
      card.id,
    ]);
    const second = await get('/__fixtures-live/typical');
    const body = await second.json();
    const changed = body.columns
      .flatMap((c: { cards: { id: number; title: string }[] }) => c.cards)
      .find((c: { id: number }) => c.id === card.id);
    expect(changed.title).toBe('Changed by SQL');
    const v2 = (await (await get('/__fixtures-live/typical/version')).json()).version;
    expect(v2).not.toBe(v1);
    expect(second.headers.get('x-live-version')).toBe(v2);
  });

  it('answers a clear JSON error: 404 unknown scenario, 503 with the seed hint when not seeded', async () => {
    const unknown = await get('/__fixtures-live/nope');
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error).toContain('nope');

    await dropSchemas(pool, sb);
    const gone = await get('/__fixtures-live/typical');
    expect(gone.status).toBe(503);
    expect((await gone.json()).error).toContain('npm run db:seed-storybook');
    expect((await get('/__fixtures-live/typical/version')).status).toBe(503);
    await runMigrations(pool, sb);
    await seedStorybook(pool, sb);
  });

  it('ignores other paths (the /__fixtures routes are untouched)', async () => {
    expect((await get('/__fixtures')).status).toBe(404);
    expect((await get('/__fixtures/typical')).status).toBe(404);
  });
});
