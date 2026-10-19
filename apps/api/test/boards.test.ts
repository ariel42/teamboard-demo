import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boardPayloadSchema } from '@teamboard/db';
import type { BoardPayload, BoardSummary } from '@teamboard/db';
import { startHarness } from './helpers.ts';
import type { Harness } from './helpers.ts';

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

describe('GET /api/boards', () => {
  it('lists boards with card counts', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/boards' });
    expect(res.statusCode).toBe(200);
    const boards = res.json<BoardSummary[]>();
    expect(boards).toHaveLength(1);
    expect(boards[0]).toMatchObject({ id: h.boardId, name: 'Sprint 24' });
    const payload = await h.board();
    expect(boards[0]!.cardCount).toBe(payload.columns.flatMap((c) => c.cards).length);
  });
});

describe('GET /api/boards/:id', () => {
  it('returns a payload that satisfies the shared schema', async () => {
    const res = await h.app.inject({ method: 'GET', url: `/api/boards/${h.boardId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<BoardPayload>();
    expect(boardPayloadSchema.safeParse(body).success).toBe(true);
    expect(body.columns.map((c) => c.name)).toEqual(['Backlog', 'In Progress', 'Review', 'Done']);
    expect(body.users).toHaveLength(5);
  });

  it('includes comment counts and resolved assignees', async () => {
    const body = await h.board();
    const cards = body.columns.flatMap((c) => c.cards);
    expect(cards.some((c) => c.commentCount > 0)).toBe(true);
    expect(cards.some((c) => c.assignee?.name)).toBe(true);
  });

  it('404s for a missing board', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/boards/999999' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('400s for malformed or out-of-range ids', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999', '1e3']) {
      const res = await h.app.inject({ method: 'GET', url: `/api/boards/${id}` });
      expect(res.statusCode, id).toBe(400);
      expect(res.json().error).toBe('validation_error');
    }
  });
});
