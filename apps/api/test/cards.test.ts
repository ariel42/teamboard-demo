import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BoardPayload, Card, Comment } from '@teamboard/db';
import { startHarness } from './helpers.ts';
import type { Harness } from './helpers.ts';

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

const titles = (b: BoardPayload) => b.columns.map((c) => c.cards.map((x) => x.title));
const dense = (b: BoardPayload) =>
  b.columns.every((c) => c.cards.every((x, i) => x.position === i));

async function columnIds(): Promise<number[]> {
  return (await h.board()).columns.map((c) => c.id);
}
async function post(payload: unknown) {
  return h.app.inject({ method: 'POST', url: '/api/cards', payload: payload as object });
}
async function patch(id: number, payload: unknown) {
  return h.app.inject({ method: 'PATCH', url: `/api/cards/${id}`, payload: payload as object });
}

describe('POST /api/cards', () => {
  it('creates a card with defaults at the end of the column', async () => {
    const [backlog] = await columnIds();
    const before = (await h.board()).columns[0]!.cards.length;
    const res = await post({ columnId: backlog, title: '  Brand new  ' });
    expect(res.statusCode).toBe(201);
    const card = res.json<Card>();
    expect(card).toMatchObject({
      title: 'Brand new',
      columnId: backlog,
      description: '',
      priority: 'medium',
      assigneeId: null,
      dueDate: null,
      labels: [],
      position: before,
    });
    expect(card.id).toEqual(expect.any(Number));
    const board = await h.board();
    expect(board.columns[0]!.cards.at(-1)!.title).toBe('Brand new');
  });

  it('accepts every optional field', async () => {
    const [backlog] = await columnIds();
    const user = (await h.board()).users[0]!;
    const res = await post({
      columnId: backlog,
      title: 'Full',
      description: 'Some text',
      priority: 'urgent',
      assigneeId: user.id,
      dueDate: '2027-01-31',
      labels: ['a', 'b'],
      position: 0,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      priority: 'urgent',
      assigneeId: user.id,
      dueDate: '2027-01-31',
      labels: ['a', 'b'],
      position: 0,
    });
    expect(dense(await h.board())).toBe(true);
  });

  it('400s on invalid input', async () => {
    const [backlog] = await columnIds();
    const cases: unknown[] = [
      {},
      { title: 'x' },
      { columnId: backlog },
      { columnId: backlog, title: '' },
      { columnId: backlog, title: '   ' },
      { columnId: backlog, title: 'x'.repeat(501) },
      { columnId: 'one', title: 'x' },
      { columnId: 0, title: 'x' },
      { columnId: backlog, title: 'x', priority: 'critical' },
      { columnId: backlog, title: 'x', dueDate: '2027-02-30' },
      { columnId: backlog, title: 'x', dueDate: 'tomorrow' },
      { columnId: backlog, title: 'x', labels: 'bug' },
      { columnId: backlog, title: 'x', labels: Array.from({ length: 21 }, (_, i) => `l${i}`) },
      { columnId: backlog, title: 'x', position: -1 },
      { columnId: backlog, title: 'x', unknown: true },
    ];
    for (const payload of cases) {
      const res = await post(payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      const body = res.json();
      expect(body.error).toBe('validation_error');
      expect(body.details.length).toBeGreaterThan(0);
    }
    expect((await h.app.inject({ method: 'POST', url: '/api/cards' })).statusCode).toBe(400);
  });

  it('422s for unknown column or assignee', async () => {
    const [backlog] = await columnIds();
    const a = await post({ columnId: 999_999, title: 'x' });
    expect(a.statusCode).toBe(422);
    expect(a.json().error).toBe('invalid_reference');
    const b = await post({ columnId: backlog, title: 'x', assigneeId: 999_999 });
    expect(b.statusCode).toBe(422);
  });

  it('stores unicode text intact', async () => {
    const [backlog] = await columnIds();
    const res = await post({ columnId: backlog, title: 'שלום עולם 👋 — ünï' });
    expect(res.json().title).toBe('שלום עולם 👋 — ünï');
  });
});

describe('PATCH /api/cards/:id', () => {
  it('updates plain fields', async () => {
    const [backlog] = await columnIds();
    const { id } = (await post({ columnId: backlog, title: 'Edit me' })).json<Card>();
    const res = await patch(id, { title: 'Edited', priority: 'low', labels: ['x'], dueDate: null });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, title: 'Edited', priority: 'low', labels: ['x'] });
    const cleared = await patch(id, { assigneeId: null });
    expect(cleared.json().assigneeId).toBeNull();
  });

  it('moves a card across columns and keeps positions consistent', async () => {
    const before = await h.board();
    const [backlog, inProgress] = before.columns;
    const moving = backlog!.cards[0]!;
    const res = await patch(moving.id, { columnId: inProgress!.id, position: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ columnId: inProgress!.id, position: 1 });

    const after = await h.board();
    expect(dense(after)).toBe(true);
    expect(after.columns[0]!.cards).toHaveLength(backlog!.cards.length - 1);
    expect(after.columns[1]!.cards).toHaveLength(inProgress!.cards.length + 1);
    expect(after.columns[1]!.cards[1]!.id).toBe(moving.id);
    // Cards that were not moved keep their relative order.
    expect(after.columns[0]!.cards.map((c) => c.id)).toEqual(
      backlog!.cards.slice(1).map((c) => c.id),
    );
    const expected = inProgress!.cards.map((c) => c.id);
    expected.splice(1, 0, moving.id);
    expect(after.columns[1]!.cards.map((c) => c.id)).toEqual(expected);
  });

  it('reorders within a column', async () => {
    const before = await h.board();
    const col = before.columns[2]!;
    const last = col.cards.at(-1)!;
    const res = await patch(last.id, { position: 0 });
    expect(res.statusCode).toBe(200);
    const after = await h.board();
    expect(after.columns[2]!.cards.map((c) => c.id)).toEqual([
      last.id,
      ...col.cards.slice(0, -1).map((c) => c.id),
    ]);
    expect(dense(after)).toBe(true);
  });

  it('clamps an oversized position to the end', async () => {
    const before = await h.board();
    const first = before.columns[3]!.cards[0]!;
    await patch(first.id, { position: 1000 });
    const after = await h.board();
    expect(after.columns[3]!.cards.at(-1)!.id).toBe(first.id);
    expect(dense(after)).toBe(true);
  });

  it('never loses or duplicates cards across many moves', async () => {
    const start = await h.board();
    const ids = start.columns.flatMap((c) => c.cards.map((x) => x.id)).sort((a, b) => a - b);
    const cols = start.columns.map((c) => c.id);
    for (let i = 0; i < 20; i++) {
      const id = ids[(i * 7) % ids.length]!;
      const res = await patch(id, { columnId: cols[(i * 3) % cols.length], position: i % 4 });
      expect(res.statusCode).toBe(200);
    }
    const end = await h.board();
    expect(dense(end)).toBe(true);
    expect(end.columns.flatMap((c) => c.cards.map((x) => x.id)).sort((a, b) => a - b)).toEqual(ids);
  });

  it('400s on invalid input and empty bodies', async () => {
    const card = (await h.board()).columns[0]!.cards[0]!;
    const cases: unknown[] = [
      {},
      { title: '' },
      { priority: 'nope' },
      { columnId: 'x' },
      { position: 1.5 },
      { dueDate: '31-12-2027' },
      { id: 5 },
      { createdAt: '2020-01-01' },
    ];
    for (const payload of cases) {
      const res = await patch(card.id, payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json().error).toBe('validation_error');
    }
    expect((await h.app.inject({ method: 'PATCH', url: `/api/cards/${card.id}` })).statusCode).toBe(
      400,
    );
  });

  it('400s for bad ids, 404s for missing cards', async () => {
    expect(
      (await h.app.inject({ method: 'PATCH', url: '/api/cards/abc', payload: { title: 'x' } }))
        .statusCode,
    ).toBe(400);
    const missing = await patch(999_999, { title: 'x' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toBe('not_found');
  });

  it('422s for unknown references and changes nothing', async () => {
    const before = await h.board();
    const card = before.columns[0]!.cards[0]!;
    expect((await patch(card.id, { columnId: 999_999 })).statusCode).toBe(422);
    expect((await patch(card.id, { assigneeId: 999_999 })).statusCode).toBe(422);
    expect(titles(await h.board())).toEqual(titles(before));
  });
});

describe('DELETE /api/cards/:id', () => {
  it('deletes a card, closes the gap and 404s the second time', async () => {
    const before = await h.board();
    const col = before.columns[1]!;
    const victim = col.cards[0]!;
    const res = await h.app.inject({ method: 'DELETE', url: `/api/cards/${victim.id}` });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const after = await h.board();
    expect(after.columns[1]!.cards.map((c) => c.id)).toEqual(col.cards.slice(1).map((c) => c.id));
    expect(dense(after)).toBe(true);

    const again = await h.app.inject({ method: 'DELETE', url: `/api/cards/${victim.id}` });
    expect(again.statusCode).toBe(404);
  });

  it('400s for a malformed id', async () => {
    const res = await h.app.inject({ method: 'DELETE', url: '/api/cards/zero' });
    expect(res.statusCode).toBe(400);
  });
});

describe('comments', () => {
  it('lists, creates and counts comments', async () => {
    const board = await h.board();
    const card = board.columns[0]!.cards.find((c) => c.commentCount === 0)!;
    const author = board.users[1]!;
    const url = `/api/cards/${card.id}/comments`;

    const empty = await h.app.inject({ method: 'GET', url });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual([]);

    const created = await h.app.inject({
      method: 'POST',
      url,
      payload: { authorId: author.id, body: '  First! ' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json<Comment>()).toMatchObject({
      cardId: card.id,
      authorId: author.id,
      body: 'First!',
      author: { id: author.id, name: author.name },
    });
    await h.app.inject({ method: 'POST', url, payload: { authorId: author.id, body: 'Second' } });

    const list = await h.app.inject({ method: 'GET', url });
    expect(list.json<Comment[]>().map((c) => c.body)).toEqual(['First!', 'Second']);

    const after = await h.board();
    const same = after.columns.flatMap((c) => c.cards).find((c) => c.id === card.id)!;
    expect(same.commentCount).toBe(2);
  });

  it('validates the body and ids', async () => {
    const board = await h.board();
    const card = board.columns[0]!.cards[0]!;
    const url = `/api/cards/${card.id}/comments`;
    const author = board.users[0]!;
    for (const payload of [
      {},
      { body: 'x' },
      { authorId: author.id },
      { authorId: author.id, body: '  ' },
      { authorId: author.id, body: 'x'.repeat(10_001) },
      { authorId: 'me', body: 'x' },
      { authorId: author.id, body: 'x', extra: 1 },
    ]) {
      const res = await h.app.inject({ method: 'POST', url, payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    const unknownAuthor = await h.app.inject({
      method: 'POST',
      url,
      payload: { authorId: 999_999, body: 'x' },
    });
    expect(unknownAuthor.statusCode).toBe(422);

    const noCard = await h.app.inject({
      method: 'POST',
      url: '/api/cards/999999/comments',
      payload: { authorId: author.id, body: 'x' },
    });
    expect(noCard.statusCode).toBe(404);
    expect(
      (await h.app.inject({ method: 'GET', url: '/api/cards/999999/comments' })).statusCode,
    ).toBe(404);
    expect((await h.app.inject({ method: 'GET', url: '/api/cards/x/comments' })).statusCode).toBe(
      400,
    );
  });
});
