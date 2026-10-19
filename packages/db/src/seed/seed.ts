import type { Pool } from '../pool.ts';
import { resolveSchemas } from '../schema-names.ts';
import type { SchemaNames } from '../schema-names.ts';
import { buildFixtures } from './fixtures.ts';
import { TYPICAL_BOARD } from './typical.ts';

export const FEATURE_FLAGS = [
  { key: 'card_comments', enabled: true, description: 'Show comments on cards.' },
  { key: 'due_dates', enabled: true, description: 'Show due dates on cards.' },
  {
    key: 'wip_limits',
    enabled: false,
    description: 'Show the WIP limit (settings.wip_limit) in column headers.',
  },
  { key: 'compact_cards', enabled: false, description: 'Use the compact card layout.' },
] as const;

export const SETTINGS: Record<string, unknown> = {
  app_title: 'Teamboard',
  wip_limit: 5,
  default_board: 'Sprint 24',
};

export interface SeedResult {
  flags: number;
  settings: number;
  fixtures: number;
  starterBoard: 'created' | 'exists';
}

/**
 * Feature flags: inserts missing flags and refreshes descriptions, but never resets `enabled`
 * (developers toggle flags live). Settings: inserts missing keys only.
 */
export async function seedConfig(pool: Pool, schemas: SchemaNames = resolveSchemas()) {
  for (const f of FEATURE_FLAGS) {
    await pool.query(
      `insert into ${schemas.config}.feature_flags (key, enabled, description)
       values ($1, $2, $3)
       on conflict (key) do update set description = excluded.description
         where ${schemas.config}.feature_flags.description is distinct from excluded.description`,
      [f.key, f.enabled, f.description],
    );
  }
  for (const [key, value] of Object.entries(SETTINGS)) {
    await pool.query(
      `insert into ${schemas.config}.settings (key, value) values ($1, $2::jsonb)
       on conflict (key) do nothing`,
      [key, JSON.stringify(value)],
    );
  }
  return { flags: FEATURE_FLAGS.length, settings: Object.keys(SETTINGS).length };
}

/** Fixtures are derived from code, so they are always refreshed (only when they changed). */
export async function seedMocks(pool: Pool, schemas: SchemaNames = resolveSchemas()) {
  const fixtures = buildFixtures();
  for (const f of fixtures) {
    await pool.query(
      `insert into ${schemas.mocks}.fixtures (name, description, data)
       values ($1, $2, $3::jsonb)
       on conflict (name) do update set description = excluded.description, data = excluded.data
         where ${schemas.mocks}.fixtures.description is distinct from excluded.description
            or ${schemas.mocks}.fixtures.data is distinct from excluded.data`,
      [f.name, f.description, JSON.stringify(f.data)],
    );
  }
  return { fixtures: fixtures.length };
}

const SEED_BASE_TIME = Date.parse('2026-10-12T09:00:00Z');

/**
 * Creates the "Sprint 24" starter board from the `typical` fixture source. If a board with that
 * name already exists nothing is touched, so cards a developer created, moved or deleted stay as
 * they are.
 */
export async function seedStarterBoard(
  pool: Pool,
  schemas: SchemaNames = resolveSchemas(),
): Promise<'created' | 'exists'> {
  const seed = TYPICAL_BOARD;
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [
      `teamboard:seed:${schemas.raw.app}`,
    ]);
    const boardRes = await client.query<{ id: number }>(
      `insert into ${schemas.app}.boards (name, description) values ($1, $2)
       on conflict (name) do nothing returning id`,
      [seed.name, seed.description],
    );
    const boardId = boardRes.rows[0]?.id;
    if (boardId === undefined) {
      await client.query('commit');
      return 'exists';
    }

    const userIds = new Map<string, number>();
    for (const u of seed.users) {
      await client.query(
        `insert into ${schemas.app}.users (name, initials, color) values ($1, $2, $3)
         on conflict (name) do nothing`,
        [u.name, u.initials, u.color],
      );
    }
    const usersRes = await client.query<{ id: number; name: string }>(
      `select id, name from ${schemas.app}.users where name = any($1)`,
      [seed.users.map((u) => u.name)],
    );
    for (const u of usersRes.rows) userIds.set(u.name, u.id);
    const userId = (name: string): number => {
      const id = userIds.get(name);
      if (id === undefined) throw new Error(`Seed refers to unknown user "${name}"`);
      return id;
    };

    let minute = 0;
    for (const [ci, col] of seed.columns.entries()) {
      const colRes = await client.query<{ id: number }>(
        `insert into ${schemas.app}.columns (board_id, name, position) values ($1, $2, $3)
         returning id`,
        [boardId, col.name, ci],
      );
      const columnId = colRes.rows[0]!.id;
      for (const [pi, card] of col.cards.entries()) {
        const createdAt = new Date(SEED_BASE_TIME + minute++ * 60_000).toISOString();
        const cardRes = await client.query<{ id: number }>(
          `insert into ${schemas.app}.cards
             (column_id, title, description, assignee_id, priority, due_date, labels, position,
              created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
           returning id`,
          [
            columnId,
            card.title,
            card.description ?? '',
            card.assignee ? userId(card.assignee) : null,
            card.priority ?? 'medium',
            card.due ?? null,
            card.labels ?? [],
            pi,
            createdAt,
          ],
        );
        const cardId = cardRes.rows[0]!.id;
        for (const c of card.comments ?? []) {
          await client.query(
            `insert into ${schemas.app}.comments (card_id, author_id, body, created_at)
             values ($1, $2, $3, $4)`,
            [cardId, userId(c.author), c.body, c.at],
          );
        }
      }
    }
    await client.query('commit');
    return 'created';
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function seedAll(
  pool: Pool,
  schemas: SchemaNames = resolveSchemas(),
): Promise<SeedResult> {
  const config = await seedConfig(pool, schemas);
  const mocks = await seedMocks(pool, schemas);
  const starterBoard = await seedStarterBoard(pool, schemas);
  return { ...config, ...mocks, starterBoard };
}
