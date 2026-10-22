import { createHash } from 'node:crypto';
import type { Pool } from '../pool.ts';
import { createRepo } from '../repo.ts';
import { resolveSchemas } from '../schema-names.ts';
import type { SchemaNames } from '../schema-names.ts';
import type { BoardPayload } from '../types.ts';
import { buildFixtures } from './fixtures.ts';
import { isStorybookPrefix, scenarioSettingKey, STORYBOOK_PREFIX } from './storybook.ts';

/**
 * Read side of the Storybook mirror: builds a scenario's board payload live from `sb_app`
 * (or a throwaway test prefix) with the API's own `getBoardPayload`. Used by the Storybook dev
 * server endpoint `/__fixtures-live/:name`. Read-only, nothing is cached.
 */

export const SEED_HINT = 'Run "npm run db:seed-storybook" to create and fill the sb_ schemas.';

export class LiveScenarioError extends Error {
  readonly status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = 'LiveScenarioError';
    this.status = status;
  }
}

/** `sb_`, or the throwaway prefix from TEAMBOARD_STORYBOOK_PREFIX (tests only; others rejected). */
export function liveSchemas(env: NodeJS.ProcessEnv = process.env): SchemaNames {
  const prefix = env.TEAMBOARD_STORYBOOK_PREFIX || STORYBOOK_PREFIX;
  if (!isStorybookPrefix(prefix)) {
    throw new LiveScenarioError(
      `TEAMBOARD_STORYBOOK_PREFIX "${prefix}" is not a Storybook test prefix.`,
      500,
    );
  }
  return resolveSchemas(prefix);
}

/** Board id of a scenario: the `storybook_scenario_<name>` setting, else the board's name. */
export async function findScenarioBoardId(
  pool: Pool,
  schemas: SchemaNames,
  name: string,
): Promise<number | undefined> {
  const fixture = buildFixtures().find((f) => f.name === name);
  if (!fixture) throw new LiveScenarioError(`Unknown scenario "${name}".`, 404);
  const mapped = await pool.query<{ id: number }>(
    `select b.id from ${schemas.config}.settings s
       join ${schemas.app}.boards b on b.id = case
              when jsonb_typeof(s.value) = 'number' and (s.value #>> '{}') ~ '^[0-9]{1,9}$'
              then (s.value #>> '{}')::int end
      where s.key = $1`,
    [scenarioSettingKey(name)],
  );
  if (mapped.rows[0]) return mapped.rows[0].id;
  const byName = await pool.query<{ id: number }>(
    `select id from ${schemas.app}.boards where name = $1 order by id limit 1`,
    [fixture.data.board.name],
  );
  return byName.rows[0]?.id;
}

/** The scenario's board as the API would serve it. Throws LiveScenarioError (503 + hint). */
export async function readLiveScenario(
  pool: Pool,
  schemas: SchemaNames,
  name: string,
): Promise<BoardPayload> {
  try {
    const id = await findScenarioBoardId(pool, schemas, name);
    const payload = id === undefined ? null : await createRepo(pool, schemas).getBoardPayload(id);
    if (!payload) {
      throw new LiveScenarioError(`Scenario "${name}" is not in ${schemas.raw.app}. ${SEED_HINT}`);
    }
    return payload;
  } catch (err) {
    if (err instanceof LiveScenarioError) throw err;
    const code = (err as { code?: string }).code;
    // 3F000 invalid_schema_name, 42P01 undefined_table: the schemas were never created.
    if (code === '3F000' || code === '42P01') {
      throw new LiveScenarioError(`${schemas.raw.app} is not set up. ${SEED_HINT}`);
    }
    throw new LiveScenarioError(`Reading ${schemas.raw.app} failed: ${(err as Error).message}`);
  }
}

/** Cheap change detector: md5 of the payload JSON. */
export function payloadVersion(payload: BoardPayload): string {
  return createHash('md5').update(JSON.stringify(payload)).digest('hex');
}
