import type { PoolClient } from 'pg';
import { runMigrations } from '../migrate.ts';
import type { Pool } from '../pool.ts';
import { resolveSchemas } from '../schema-names.ts';
import type { SchemaNames } from '../schema-names.ts';
import { buildFixtures } from './fixtures.ts';
import type { Fixture } from './fixtures.ts';
import { seedConfig } from './seed.ts';
import { TYPICAL_BOARD } from './typical.ts';

/**
 * Storybook "live" mirror: the six fixture scenarios as real rows in `sb_app` / `sb_config`, so a
 * row edited there shows up in Storybook while the real `app` data is never touched.
 *
 * Insert-only: a scenario whose board already exists is left alone (edits survive reruns).
 * Which board belongs to which scenario is recorded in `<prefix>config.settings` under the key
 * `storybook_scenario_<name>` (value: the board id), so renaming a board does not lose the link.
 * If the key is missing or not a valid board id, the board is found by the fixture's board name
 * instead (the mock-marked name, see `mockBoardName`) and the key is repaired.
 */
export const STORYBOOK_PREFIX = 'sb_';

export const scenarioSettingKey = (name: string) => `storybook_scenario_${name}`;

/**
 * Every board and column name in the mirror carries a visible "mock" marker, so nobody mistakes
 * the rows for real app data: boards get a suffix ` · mock` ("Sprint 24 · mock"), columns get
 * ` (mock)` ("To do (mock)"). Card titles are left as they are. Applied only when seeding `sb_*`;
 * the `mocks.fixtures` JSON keeps the plain names. The same marker is used for every scenario,
 * the Hebrew one included (see docs/storybook.md).
 */
export const mockBoardName = (name: string) => `${name} · mock`;
export const mockColumnName = (name: string) => `${name} (mock)`;

export interface ScenarioResult {
  scenario: string;
  board: 'created' | 'exists';
  boardId: number;
}

const SEED_BASE_TIME = Date.parse('2026-10-12T09:00:00Z');

/** Real comment bodies exist only for the `typical` scenario; the others only have a count. */
function realComments(fixture: Fixture, cardTitle: string) {
  if (fixture.name !== 'typical') return undefined;
  return TYPICAL_BOARD.columns.flatMap((c) => c.cards).find((c) => c.title === cardTitle)?.comments;
}

async function findBoard(
  client: PoolClient,
  schemas: SchemaNames,
  fixture: Fixture,
): Promise<number | undefined> {
  const key = scenarioSettingKey(fixture.name);
  const mapped = await client.query<{ id: number }>(
    `select b.id from ${schemas.config}.settings s
       join ${schemas.app}.boards b on b.id = case
              when jsonb_typeof(s.value) = 'number' and (s.value #>> '{}') ~ '^[0-9]{1,9}$'
              then (s.value #>> '{}')::int end
      where s.key = $1`,
    [key],
  );
  if (mapped.rows[0]) return mapped.rows[0].id;
  const byName = await client.query<{ id: number }>(
    `select id from ${schemas.app}.boards where name = $1`,
    [mockBoardName(fixture.data.board.name)],
  );
  const id = byName.rows[0]?.id;
  if (id !== undefined) await recordBoard(client, schemas, key, id);
  return id;
}

async function recordBoard(client: PoolClient, schemas: SchemaNames, key: string, id: number) {
  await client.query(
    `insert into ${schemas.config}.settings (key, value) values ($1, $2::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [key, JSON.stringify(id)],
  );
}

async function createScenarioBoard(
  client: PoolClient,
  schemas: SchemaNames,
  fixture: Fixture,
): Promise<number> {
  const { board, users, columns } = fixture.data;
  const boardRes = await client.query<{ id: number }>(
    `insert into ${schemas.app}.boards (name, description) values ($1, $2) returning id`,
    [mockBoardName(board.name), board.description],
  );
  const boardId = boardRes.rows[0]!.id;

  // Users are shared across boards (name is unique); existing ones are kept as they are.
  const userIds = new Map<string, number>();
  for (const u of users) {
    await client.query(
      `insert into ${schemas.app}.users (name, initials, color) values ($1, $2, $3)
       on conflict (name) do nothing`,
      [u.name, u.initials, u.color],
    );
  }
  const usersRes = await client.query<{ id: number; name: string }>(
    `select id, name from ${schemas.app}.users where name = any($1)`,
    [users.map((u) => u.name)],
  );
  for (const u of usersRes.rows) userIds.set(u.name, u.id);
  const userId = (name: string): number => {
    const id = userIds.get(name);
    if (id === undefined) throw new Error(`Scenario "${fixture.name}": unknown user "${name}"`);
    return id;
  };

  let minute = 0;
  for (const col of columns) {
    const colRes = await client.query<{ id: number }>(
      `insert into ${schemas.app}.columns (board_id, name, position) values ($1, $2, $3)
       returning id`,
      [boardId, mockColumnName(col.name), col.position],
    );
    const columnId = colRes.rows[0]!.id;
    for (const card of col.cards) {
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
          card.description,
          card.assignee ? userId(card.assignee.name) : null,
          card.priority,
          card.dueDate,
          card.labels,
          card.position,
          createdAt,
        ],
      );
      const cardId = cardRes.rows[0]!.id;
      const real = realComments(fixture, card.title);
      if (real) {
        for (const c of real) {
          await client.query(
            `insert into ${schemas.app}.comments (card_id, author_id, body, created_at)
             values ($1, $2, $3, $4)`,
            [cardId, userId(c.author), c.body, c.at],
          );
        }
      } else if (card.commentCount > 0) {
        // The payload only carries a number: create that many placeholder comments.
        const authorId = card.assignee ? userId(card.assignee.name) : userId(users[0]!.name);
        await client.query(
          `insert into ${schemas.app}.comments (card_id, author_id, body, created_at)
           select $1, $2, 'Comment ' || g, $3::timestamptz + g * interval '1 minute'
             from generate_series(1, $4::int) g`,
          [cardId, authorId, createdAt, card.commentCount],
        );
      }
    }
  }
  await recordBoard(client, schemas, scenarioSettingKey(fixture.name), boardId);
  return boardId;
}

/**
 * Seeds the six scenarios into already-migrated schemas. Insert-only (see the file comment).
 * Also seeds `<prefix>config` (feature flags, settings) with the same insert-only rules as db:seed.
 * Does not touch `<prefix>mocks`.
 */
export async function seedStorybook(
  pool: Pool,
  schemas: SchemaNames = resolveSchemas(STORYBOOK_PREFIX),
): Promise<ScenarioResult[]> {
  await seedConfig(pool, schemas);
  const results: ScenarioResult[] = [];
  for (const fixture of buildFixtures()) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [
        `teamboard:seed-storybook:${schemas.raw.app}`,
      ]);
      const existing = await findBoard(client, schemas, fixture);
      if (existing !== undefined) {
        results.push({ scenario: fixture.name, board: 'exists', boardId: existing });
      } else {
        const boardId = await createScenarioBoard(client, schemas, fixture);
        results.push({ scenario: fixture.name, board: 'created', boardId });
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
  return results;
}

const ALLOWED_PREFIX = new RegExp(`^(${STORYBOOK_PREFIX}|t[0-9a-f]{8}_(${STORYBOOK_PREFIX})?)$`);

/** True for the mirror prefix `sb_` and for throwaway test prefixes (`t<hex>_`, `t<hex>_sb_`). */
export function isStorybookPrefix(prefix: string): boolean {
  return ALLOWED_PREFIX.test(prefix);
}

/**
 * Drops and recreates only this prefix's schemas, then reseeds. `schemas` is required and only
 * `sb_` or a `t<hex>_` test prefix is accepted, so a caller can never drop the real schemas by
 * passing `resolveSchemas()` with DB_SCHEMA_PREFIX set.
 */
export async function resetStorybook(pool: Pool, schemas: SchemaNames): Promise<ScenarioResult[]> {
  if (!isStorybookPrefix(schemas.prefix)) {
    throw new Error(
      `Refusing to reset schemas with prefix "${schemas.prefix}": only "${STORYBOOK_PREFIX}" (or a test prefix) is allowed.`,
    );
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Same lock as runMigrations, so a concurrent migrate cannot interleave with the drop.
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [
      `teamboard:migrate:${schemas.raw.app}`,
    ]);
    await client.query(
      `drop schema if exists ${schemas.app}, ${schemas.config}, ${schemas.mocks} cascade`,
    );
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  await runMigrations(pool, schemas);
  return seedStorybook(pool, schemas);
}
