import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DomainError, createRepo } from '../src/index.ts';
import type { Repo } from '../src/index.ts';
import { createTestSchema } from '../src/testing.ts';
import type { TestSchema } from '../src/testing.ts';

describe('repo', () => {
  let t: TestSchema;
  let repo: Repo;
  let boardId: number;
  let cols: number[];
  let userIds: number[];

  beforeAll(async () => {
    t = await createTestSchema();
    repo = createRepo(t.pool, t.schemas);
  });
  afterAll(async () => {
    await t.drop();
  });

  beforeEach(async () => {
    await t.pool.query(
      `truncate ${t.schemas.app}.boards, ${t.schemas.app}.users restart identity cascade`,
    );
    const { app } = t.schemas;
    boardId = (
      await t.pool.query<{ id: number }>(
        `insert into ${app}.boards (name) values ('B') returning id`,
      )
    ).rows[0]!.id;
    cols = [];
    for (const [i, name] of ['A', 'B', 'C'].entries()) {
      const r = await t.pool.query<{ id: number }>(
        `insert into ${app}.columns (board_id, name, position) values ($1, $2, $3) returning id`,
        [boardId, name, i],
      );
      cols.push(r.rows[0]!.id);
    }
    userIds = [];
    for (const name of ['Ann', 'Bob']) {
      const r = await t.pool.query<{ id: number }>(
        `insert into ${app}.users (name, initials, color) values ($1, 'XX', '#000000') returning id`,
        [name],
      );
      userIds.push(r.rows[0]!.id);
    }
  });

  /** Returns "title@position" lists per column, e.g. [["a","b"],["c"],[]]. */
  async function layout(): Promise<string[][]> {
    const p = (await repo.getBoardPayload(boardId))!;
    return p.columns.map((c) => c.cards.map((x) => x.title));
  }
  async function positionsAreDense(): Promise<boolean> {
    const p = (await repo.getBoardPayload(boardId))!;
    return p.columns.every((c) => c.cards.every((x, i) => x.position === i));
  }
  async function seedCards(column: number, titles: string[]) {
    const out = [];
    for (const title of titles) out.push(await repo.createCard({ columnId: column, title }));
    return out;
  }

  it('appends cards to the end of a column by default', async () => {
    const cards = await seedCards(cols[0]!, ['a', 'b', 'c']);
    expect(cards.map((c) => c.position)).toEqual([0, 1, 2]);
    expect(cards[0]).toMatchObject({
      description: '',
      priority: 'medium',
      assigneeId: null,
      dueDate: null,
      labels: [],
    });
  });

  it('inserts at a given position and shifts the rest', async () => {
    await seedCards(cols[0]!, ['a', 'b', 'c']);
    await repo.createCard({ columnId: cols[0]!, title: 'x', position: 1 });
    expect(await layout()).toEqual([['a', 'x', 'b', 'c'], [], []]);
    await repo.createCard({ columnId: cols[0]!, title: 'far', position: 99 });
    expect((await layout())[0]).toEqual(['a', 'x', 'b', 'c', 'far']);
    expect(await positionsAreDense()).toBe(true);
  });

  it('moves a card to another column at a position', async () => {
    const [a, b, c] = await seedCards(cols[0]!, ['a', 'b', 'c']);
    await seedCards(cols[1]!, ['x', 'y']);
    const moved = await repo.updateCard(b!.id, { columnId: cols[1]!, position: 1 });
    expect(moved).toMatchObject({ columnId: cols[1], position: 1 });
    expect(await layout()).toEqual([['a', 'c'], ['x', 'b', 'y'], []]);
    expect(await positionsAreDense()).toBe(true);
    expect(a!.id).not.toBe(c!.id);
  });

  it('appends when only the column changes', async () => {
    const [a] = await seedCards(cols[0]!, ['a', 'b']);
    await seedCards(cols[2]!, ['x', 'y']);
    await repo.updateCard(a!.id, { columnId: cols[2]! });
    expect(await layout()).toEqual([['b'], [], ['x', 'y', 'a']]);
    expect(await positionsAreDense()).toBe(true);
  });

  it('reorders inside a column, down and up', async () => {
    const [a, , , d] = await seedCards(cols[0]!, ['a', 'b', 'c', 'd']);
    await repo.updateCard(a!.id, { position: 2 });
    expect((await layout())[0]).toEqual(['b', 'c', 'a', 'd']);
    await repo.updateCard(d!.id, { position: 0 });
    expect((await layout())[0]).toEqual(['d', 'b', 'c', 'a']);
    await repo.updateCard(d!.id, { position: 500 });
    expect((await layout())[0]).toEqual(['b', 'c', 'a', 'd']);
    expect(await positionsAreDense()).toBe(true);
  });

  it('moving to the current spot changes nothing', async () => {
    const [, b] = await seedCards(cols[0]!, ['a', 'b', 'c']);
    await repo.updateCard(b!.id, { columnId: cols[0]!, position: 1 });
    expect((await layout())[0]).toEqual(['a', 'b', 'c']);
  });

  it('closes the gap when a card is deleted', async () => {
    const [, b] = await seedCards(cols[0]!, ['a', 'b', 'c']);
    expect(await repo.deleteCard(b!.id)).toBe(true);
    expect(await repo.deleteCard(b!.id)).toBe(false);
    expect(await layout()).toEqual([['a', 'c'], [], []]);
    expect(await positionsAreDense()).toBe(true);
  });

  it('keeps positions consistent under concurrent moves', async () => {
    const cards = await seedCards(cols[0]!, ['a', 'b', 'c', 'd', 'e', 'f']);
    await Promise.all(
      cards.map((c, i) => repo.updateCard(c.id, { columnId: cols[i % 3]!, position: 0 })),
    );
    expect(await positionsAreDense()).toBe(true);
    const total = (await layout()).flat().length;
    expect(total).toBe(6);
  });

  it('updates plain fields and bumps updated_at', async () => {
    const [a] = await seedCards(cols[0]!, ['a']);
    const updated = await repo.updateCard(a!.id, {
      title: 'new',
      description: 'd',
      priority: 'urgent',
      assigneeId: userIds[0]!,
      dueDate: '2026-12-24',
      labels: ['bug', 'backend'],
    });
    expect(updated).toMatchObject({
      title: 'new',
      description: 'd',
      priority: 'urgent',
      assigneeId: userIds[0],
      dueDate: '2026-12-24',
      labels: ['bug', 'backend'],
      position: 0,
    });
    expect(Date.parse(updated!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(a!.updatedAt));
    const cleared = await repo.updateCard(a!.id, { assigneeId: null, dueDate: null });
    expect(cleared).toMatchObject({ assigneeId: null, dueDate: null });
  });

  it('returns null for unknown cards and rejects unknown references', async () => {
    expect(await repo.updateCard(999_999, { title: 'x' })).toBeNull();
    expect(await repo.getCard(999_999)).toBeNull();
    await expect(repo.createCard({ columnId: 999_999, title: 'x' })).rejects.toMatchObject({
      code: 'invalid_reference',
    });
    const [a] = await seedCards(cols[0]!, ['a']);
    await expect(repo.updateCard(a!.id, { columnId: 999_999 })).rejects.toBeInstanceOf(DomainError);
    await expect(repo.updateCard(a!.id, { assigneeId: 999_999 })).rejects.toMatchObject({
      code: 'invalid_reference',
    });
    // The failed updates must not have changed anything.
    expect(await layout()).toEqual([['a'], [], []]);
  });

  it('counts comments and lists them with authors', async () => {
    const [a, b] = await seedCards(cols[0]!, ['a', 'b']);
    expect(await repo.listComments(a!.id)).toEqual([]);
    const first = await repo.createComment(a!.id, { authorId: userIds[0]!, body: 'one' });
    await repo.createComment(a!.id, { authorId: userIds[1]!, body: 'two' });
    expect(first.author).toMatchObject({ id: userIds[0], name: 'Ann' });
    const comments = await repo.listComments(a!.id);
    expect(comments!.map((c) => c.body)).toEqual(['one', 'two']);

    const payload = (await repo.getBoardPayload(boardId))!;
    const cards = payload.columns[0]!.cards;
    expect(cards.find((c) => c.id === a!.id)!.commentCount).toBe(2);
    expect(cards.find((c) => c.id === b!.id)!.commentCount).toBe(0);

    expect(await repo.listComments(999_999)).toBeNull();
    await expect(
      repo.createComment(999_999, { authorId: userIds[0]!, body: 'x' }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(repo.createComment(a!.id, { authorId: 999_999, body: 'x' })).rejects.toMatchObject(
      { code: 'invalid_reference' },
    );
  });

  it('deleting a card removes its comments', async () => {
    const [a] = await seedCards(cols[0]!, ['a']);
    await repo.createComment(a!.id, { authorId: userIds[0]!, body: 'bye' });
    await repo.deleteCard(a!.id);
    const { rows } = await t.pool.query(`select 1 from ${t.schemas.app}.comments`);
    expect(rows).toHaveLength(0);
  });
});
