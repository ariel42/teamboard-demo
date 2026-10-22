import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LiveScenarioError,
  boardPayloadSchema,
  buildFixtures,
  createPool,
  dropSchemas,
  findScenarioBoardId,
  liveSchemas,
  mockBoardName,
  payloadVersion,
  readLiveScenario,
  resolveSchemas,
  runMigrations,
  scenarioSettingKey,
  seedStorybook,
} from '../src/index.ts';
import type { Pool, SchemaNames } from '../src/index.ts';

/** Real Postgres, throwaway `t<hex>_sb_` prefix: the real sb_* schemas are never touched. */
describe('storybook live read (real Postgres, throwaway prefix)', () => {
  let pool: Pool;
  let sb: SchemaNames;
  let empty: SchemaNames;

  beforeAll(async () => {
    pool = createPool({ max: 3 });
    sb = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`);
    empty = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`); // never created
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

  it('builds every scenario with the API payload shape', async () => {
    for (const f of buildFixtures()) {
      const payload = await readLiveScenario(pool, sb, f.name);
      expect(boardPayloadSchema.safeParse(payload).success, f.name).toBe(true);
      expect(payload.board.name).toBe(mockBoardName(f.data.board.name));
      expect(payload.columns.flatMap((c) => c.cards)).toHaveLength(
        f.data.columns.flatMap((c) => c.cards).length,
      );
    }
  });

  it('shows an UPDATE of a card title and changes the version; unrelated reads stay equal', async () => {
    const before = await readLiveScenario(pool, sb, 'typical');
    const v1 = payloadVersion(before);
    expect(payloadVersion(await readLiveScenario(pool, sb, 'typical'))).toBe(v1);
    const other = payloadVersion(await readLiveScenario(pool, sb, 'long-text'));

    const card = before.columns.flatMap((c) => c.cards)[0]!;
    await pool.query(`update ${sb.app}.cards set title = $2 where id = $1`, [
      card.id,
      'Edited in SQL',
    ]);

    const after = await readLiveScenario(pool, sb, 'typical');
    expect(after.columns.flatMap((c) => c.cards).find((c) => c.id === card.id)!.title).toBe(
      'Edited in SQL',
    );
    expect(payloadVersion(after)).not.toBe(v1);
    expect(payloadVersion(await readLiveScenario(pool, sb, 'long-text'))).toBe(other);
  });

  it('falls back to the board name when the scenario setting is missing', async () => {
    const id = await findScenarioBoardId(pool, sb, 'empty');
    await pool.query(`delete from ${sb.config}.settings where key = $1`, [
      scenarioSettingKey('empty'),
    ]);
    expect(await findScenarioBoardId(pool, sb, 'empty')).toBe(id);
  });

  it('answers 404 for an unknown scenario and 503 with the seed hint when sb_ is missing', async () => {
    await expect(readLiveScenario(pool, sb, 'nope')).rejects.toMatchObject({ status: 404 });
    const err = await readLiveScenario(pool, empty, 'typical').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LiveScenarioError);
    expect(err).toMatchObject({ status: 503 });
    expect((err as Error).message).toContain('npm run db:seed-storybook');
  });

  it('503 when the schemas exist but the scenario board was deleted', async () => {
    await pool.query(`delete from ${sb.config}.settings where key = $1`, [
      scenarioSettingKey('overloaded'),
    ]);
    await pool.query(`delete from ${sb.app}.boards where name = $1`, [
      mockBoardName(buildFixtures().find((f) => f.name === 'overloaded')!.data.board.name),
    ]);
    await expect(readLiveScenario(pool, sb, 'overloaded')).rejects.toMatchObject({ status: 503 });
  });

  it('only accepts sb_ or a throwaway test prefix from the environment', () => {
    expect(liveSchemas({}).prefix).toBe('sb_');
    expect(liveSchemas({ TEAMBOARD_STORYBOOK_PREFIX: sb.prefix }).prefix).toBe(sb.prefix);
    expect(() => liveSchemas({ TEAMBOARD_STORYBOOK_PREFIX: 'app_' })).toThrow(/not a Storybook/);
  });
});
