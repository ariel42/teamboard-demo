import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boardPayloadSchema, buildFixtures, createRepo, seedAll } from '../src/index.ts';
import type { Repo } from '../src/index.ts';
import { createTestSchema } from '../src/testing.ts';
import type { TestSchema } from '../src/testing.ts';

describe('seed', () => {
  let t: TestSchema;
  let repo: Repo;

  beforeAll(async () => {
    t = await createTestSchema();
    repo = createRepo(t.pool, t.schemas);
  });
  afterAll(async () => {
    await t.drop();
  });

  const counts = async () => {
    const q = async (sql: string) => (await t.pool.query<{ n: number }>(sql)).rows[0]!.n;
    const s = t.schemas;
    return {
      users: await q(`select count(*)::int n from ${s.app}.users`),
      boards: await q(`select count(*)::int n from ${s.app}.boards`),
      columns: await q(`select count(*)::int n from ${s.app}.columns`),
      cards: await q(`select count(*)::int n from ${s.app}.cards`),
      comments: await q(`select count(*)::int n from ${s.app}.comments`),
      flags: await q(`select count(*)::int n from ${s.config}.feature_flags`),
      settings: await q(`select count(*)::int n from ${s.config}.settings`),
      fixtures: await q(`select count(*)::int n from ${s.mocks}.fixtures`),
    };
  };

  it('seeds config, fixtures and the starter board', async () => {
    const result = await seedAll(t.pool, t.schemas);
    expect(result.starterBoard).toBe('created');
    const c = await counts();
    expect(c).toMatchObject({
      users: 5,
      boards: 1,
      columns: 4,
      flags: 4,
      settings: 3,
      fixtures: 6,
    });
    expect(c.cards).toBeGreaterThanOrEqual(12);
    expect(c.comments).toBeGreaterThan(0);

    expect(await repo.getFlags()).toEqual({
      card_comments: true,
      compact_cards: false,
      due_dates: true,
      wip_limits: false,
    });
    expect(await repo.getSettings()).toMatchObject({ app_title: 'Teamboard', wip_limit: 5 });
  });

  it('stores fixtures that equal the generated board payloads', async () => {
    const { rows } = await t.pool.query<{ name: string; data: unknown }>(
      `select name, data from ${t.schemas.mocks}.fixtures order by name`,
    );
    const expected = buildFixtures().sort((a, b) => a.name.localeCompare(b.name));
    expect(rows.map((r) => r.name)).toEqual(expected.map((f) => f.name));
    for (const [i, row] of rows.entries()) {
      expect(boardPayloadSchema.safeParse(row.data).success).toBe(true);
      expect(row.data).toEqual(expected[i]!.data);
    }
  });

  it('builds the starter board from the typical fixture', async () => {
    const boards = await repo.listBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0]).toMatchObject({ name: 'Sprint 24' });
    const payload = await repo.getBoardPayload(boards[0]!.id);
    const typical = buildFixtures().find((f) => f.name === 'typical')!.data;
    // Ids are identical in a fresh schema because both start counting at 1.
    expect(payload).toEqual(typical);
  });

  it('is idempotent', async () => {
    const before = await counts();
    const again = await seedAll(t.pool, t.schemas);
    expect(again.starterBoard).toBe('exists');
    expect(await counts()).toEqual(before);
  });

  it('does not overwrite cards a developer created, moved, edited or deleted', async () => {
    const [board] = await repo.listBoards();
    const payload = (await repo.getBoardPayload(board!.id))!;
    const [backlog, inProgress, review] = payload.columns;

    const created = await repo.createCard({ columnId: backlog!.id, title: 'My own card' });
    const moved = backlog!.cards[0]!;
    await repo.updateCard(moved.id, { columnId: review!.id, position: 0, title: 'Renamed by dev' });
    const deleted = inProgress!.cards[0]!;
    await repo.deleteCard(deleted.id);
    await repo.setFlag('wip_limits', true);
    await t.pool.query(
      `update ${t.schemas.config}.settings set value = '9' where key = 'wip_limit'`,
    );

    const snapshot = await repo.getBoardPayload(board!.id);
    await seedAll(t.pool, t.schemas);
    await seedAll(t.pool, t.schemas);
    expect(await repo.getBoardPayload(board!.id)).toEqual(snapshot);

    const after = (await repo.getBoardPayload(board!.id))!;
    const allCards = after.columns.flatMap((c) => c.cards);
    expect(allCards.find((c) => c.id === created.id)?.title).toBe('My own card');
    expect(allCards.find((c) => c.id === deleted.id)).toBeUndefined();
    const movedAfter = after.columns.find((c) => c.id === review!.id)!.cards[0]!;
    expect(movedAfter).toMatchObject({ id: moved.id, title: 'Renamed by dev', position: 0 });

    // Live config changes survive too.
    expect((await repo.getFlags()).wip_limits).toBe(true);
    expect((await repo.getSettings()).wip_limit).toBe(9);
  });
});
