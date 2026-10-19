import type { FastifyInstance } from 'fastify';
import { seedAll } from '@teamboard/db';
import { createTestSchema } from '@teamboard/db/testing';
import type { TestSchema } from '@teamboard/db/testing';
import type { BoardPayload } from '@teamboard/db';
import { buildApp } from '../src/app.ts';

export interface Harness {
  t: TestSchema;
  app: FastifyInstance;
  boardId: number;
  board(): Promise<BoardPayload>;
  close(): Promise<void>;
}

/** A migrated + seeded throwaway schema and an app bound to it. */
export async function startHarness(): Promise<Harness> {
  const t = await createTestSchema();
  await seedAll(t.pool, t.schemas);
  const app = await buildApp({
    pool: t.pool,
    prefix: t.prefix,
    env: { kind: 'test-kind', user: 'test-user' },
  });
  await app.ready();
  const boardId = (
    await t.pool.query<{ id: number }>(`select id from ${t.schemas.app}.boards limit 1`)
  ).rows[0]!.id;
  return {
    t,
    app,
    boardId,
    async board() {
      const res = await app.inject({ method: 'GET', url: `/api/boards/${boardId}` });
      return res.json<BoardPayload>();
    },
    async close() {
      await app.close();
      await t.drop();
    },
  };
}
