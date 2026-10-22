import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildFixtures,
  createRepo,
  dropSchemas,
  mockBoardName,
  mockColumnName,
  resetStorybook,
  resolveSchemas,
  runMigrations,
  scenarioSettingKey,
  seedStorybook,
} from '../src/index.ts';
import type { Repo, SchemaNames } from '../src/index.ts';
import { createTestSchema } from '../src/testing.ts';
import type { TestSchema } from '../src/testing.ts';

const EXPECTED_CARDS: Record<string, number> = {
  typical: 13,
  empty: 0,
  overloaded: 122,
  'long-text': 6,
  'rtl-hebrew': 12,
  'all-priorities': 16,
};

describe('storybook mirror seed (real Postgres, throwaway prefix)', () => {
  let t: TestSchema;
  let mirror: SchemaNames; // `t<hex>_sb_`: the only shape of throwaway prefix a reset accepts
  let repo: Repo;

  beforeAll(async () => {
    t = await createTestSchema({ migrate: false });
    mirror = resolveSchemas(`${t.prefix}sb_`);
    await runMigrations(t.pool, mirror);
    repo = createRepo(t.pool, mirror);
  });
  afterAll(async () => {
    try {
      await dropSchemas(t.pool, mirror);
    } finally {
      await t.drop();
    }
  });

  const boardIds = async () => {
    const out = new Map<string, number>();
    for (const f of buildFixtures()) {
      const { rows } = await t.pool.query<{ value: number }>(
        `select value from ${mirror.config}.settings where key = $1`,
        [scenarioSettingKey(f.name)],
      );
      out.set(f.name, rows[0]!.value);
    }
    return out;
  };

  it('creates one board per scenario with the expected card and comment counts', async () => {
    const results = await seedStorybook(t.pool, mirror);
    expect(results.map((r) => r.board)).toEqual(Array(6).fill('created'));

    const ids = await boardIds();
    expect(ids.size).toBe(6);
    expect(new Set(ids.values()).size).toBe(6);
    const { rows } = await t.pool.query<{ n: number }>(
      `select count(*)::int n from ${mirror.app}.boards`,
    );
    expect(rows[0]!.n).toBe(6);

    for (const f of buildFixtures()) {
      const payload = await repo.getBoardPayload(ids.get(f.name)!);
      expect(payload, f.name).not.toBeNull();
      const cards = payload!.columns.flatMap((c) => c.cards);
      expect(cards.length, f.name).toBe(EXPECTED_CARDS[f.name]);
      expect(payload!.board.name).toBe(mockBoardName(f.data.board.name));
      expect(payload!.columns.map((c) => c.name)).toEqual(
        f.data.columns.map((c) => mockColumnName(c.name)),
      );
      // Same cards, in the same order, with the same visible fields as the fixture.
      const strip = (cs: typeof cards) =>
        cs.map(({ id: _id, assignee, ...rest }) => ({ ...rest, assignee: assignee?.name ?? null }));
      expect(strip(cards), f.name).toEqual(strip(f.data.columns.flatMap((c) => c.cards)));
    }
  });

  it('marks every board and column name as mock, and leaves card titles alone', async () => {
    const names = await t.pool.query<{ kind: string; name: string }>(
      `select 'board' kind, name from ${mirror.app}.boards
       union all select 'column', name from ${mirror.app}.columns`,
    );
    expect(names.rows.length).toBeGreaterThan(6);
    for (const r of names.rows) expect(r.name, `${r.kind} ${r.name}`).toMatch(/mock/);
    expect(mockBoardName('Sprint 24')).toBe('Sprint 24 · mock');
    expect(mockColumnName('To do')).toBe('To do (mock)');
    const titles = await t.pool.query(`select 1 from ${mirror.app}.cards where title ~ 'mock'`);
    expect(titles.rowCount).toBe(0);
  });

  it('a second run does not overwrite an edited card title', async () => {
    const ids = await boardIds();
    const typical = (await repo.getBoardPayload(ids.get('typical')!))!;
    const card = typical.columns[0]!.cards[0]!;
    await repo.updateCard(card.id, { title: 'EDITED IN SB' });
    await repo.deleteCard(typical.columns[1]!.cards[0]!.id);

    const again = await seedStorybook(t.pool, mirror);
    expect(again.map((r) => r.board)).toEqual(Array(6).fill('exists'));

    const after = (await repo.getBoardPayload(ids.get('typical')!))!;
    expect(after.columns[0]!.cards[0]!.title).toBe('EDITED IN SB');
    expect(after.columns.flatMap((c) => c.cards)).toHaveLength(12);
    const { rows } = await t.pool.query<{ n: number }>(
      `select count(*)::int n from ${mirror.app}.boards`,
    );
    expect(rows[0]!.n).toBe(6);
  });

  it('survives a renamed board (the link is the stored id, not the name)', async () => {
    const ids = await boardIds();
    await t.pool.query(`update ${mirror.app}.boards set name = 'Renamed' where id = $1`, [
      ids.get('empty'),
    ]);
    const again = await seedStorybook(t.pool, mirror);
    expect(again.every((r) => r.board === 'exists')).toBe(true);
  });

  it('reset recreates the schemas and restores the original data', async () => {
    const results = await resetStorybook(t.pool, mirror);
    expect(results.map((r) => r.board)).toEqual(Array(6).fill('created'));
    const ids = await boardIds();
    const typical = (await repo.getBoardPayload(ids.get('typical')!))!;
    const titles = typical.columns.flatMap((c) => c.cards.map((x) => x.title));
    expect(titles).not.toContain('EDITED IN SB');
    expect(titles).toHaveLength(13);
    expect((await repo.listBoards()).map((b) => b.name)).not.toContain('Renamed');
  });

  it('falls back to the board name when the stored link is not a board id', async () => {
    const key = scenarioSettingKey('typical');
    for (const bad of ['"abc"', '1.5', '99999999999', 'null']) {
      await t.pool.query(`update ${mirror.config}.settings set value = $2::jsonb where key = $1`, [
        key,
        bad,
      ]);
      const again = await seedStorybook(t.pool, mirror);
      expect(
        again.every((r) => r.board === 'exists'),
        bad,
      ).toBe(true);
    }
    const ids = await boardIds();
    expect(typeof ids.get('typical')).toBe('number');
  });

  it('refuses to reset any prefix other than sb_ or a t<hex8>_sb_ test prefix', async () => {
    // t.prefix is the bare app-test prefix `t<hex8>_`: it must never be resettable.
    for (const prefix of [
      '',
      'dev_',
      'app_',
      'tzzzzzzzz_',
      't1234567_',
      t.prefix,
      'tzzzzzzzz_sb_',
    ]) {
      await expect(resetStorybook(t.pool, resolveSchemas(prefix)), prefix).rejects.toThrow(
        /Refusing/,
      );
    }
    // Nothing was dropped.
    expect((await repo.listBoards()).length).toBe(6);
  });
});
