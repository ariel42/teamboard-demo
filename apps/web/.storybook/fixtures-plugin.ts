/**
 * Vite plugin that serves the board fixtures stored in Postgres (`mocks.fixtures`) to stories.
 *
 *   dev server        GET /__fixtures          -> [{ name, description }]
 *                     GET /__fixtures/:name    -> BoardPayload (validated with boardPayloadSchema)
 *                     GET /__fixtures-live/:name          -> BoardPayload built live from sb_app (the mirror)
 *                     GET /__fixtures-live/:name/version  -> { version } (md5 of that payload)
 *   storybook build   the same data is pre-rendered into /__fixtures.json (no DB needed to serve it);
 *                     the live endpoints exist only in the dev server
 *
 * Connection: DATABASE_URL (required) and the optional DB_SCHEMA_PREFIX, like the rest of the repo.
 * Failures answer with HTTP 503 and `{ error }` so the story can show a readable error panel.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import pg from 'pg';
import type { Plugin } from 'vite';
import {
  boardPayloadSchema,
  createPool,
  liveSchemas,
  LiveScenarioError,
  payloadVersion,
  readLiveScenario,
  resolveSchemas,
} from '@teamboard/db';
import type { Pool } from '@teamboard/db';
import type { BoardPayload } from '@teamboard/db';

export interface FixtureInfo {
  name: string;
  description: string;
}

export interface StaticFixtures {
  list: FixtureInfo[];
  data: Record<string, BoardPayload>;
}

export class FixtureError extends Error {
  readonly status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = 'FixtureError';
    this.status = status;
  }
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new FixtureError(
      'DATABASE_URL is not set, so the fixtures in mocks.fixtures cannot be read.',
    );
  }
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 4000 });
  // A dropped connection must not take the Storybook process down.
  client.on('error', () => {});
  try {
    await client.connect();
  } catch (err) {
    client.end().catch(() => {});
    throw new FixtureError(
      `Cannot reach the database: ${(err as Error).message || 'connection failed'}`,
    );
  }
  try {
    return await fn(client);
  } catch (err) {
    if (err instanceof FixtureError) throw err;
    throw new FixtureError(`Reading mocks.fixtures failed: ${(err as Error).message}`);
  } finally {
    client.end().catch(() => {});
  }
}

function parsePayload(name: string, raw: unknown): BoardPayload {
  const parsed = boardPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new FixtureError(
      `Fixture "${name}" does not match the board payload schema: ${first?.path.join('.') || '(root)'} ${first?.message ?? ''}`,
      422,
    );
  }
  return parsed.data;
}

export async function listFixtures(): Promise<FixtureInfo[]> {
  return withClient(async (client) => {
    const { mocks } = resolveSchemas();
    const res = await client.query<FixtureInfo>(
      `select name, description from ${mocks}.fixtures order by name`,
    );
    return res.rows;
  });
}

export async function readFixture(name: string): Promise<BoardPayload> {
  return withClient(async (client) => {
    const { mocks } = resolveSchemas();
    const res = await client.query<{ data: unknown }>(
      `select data from ${mocks}.fixtures where name = $1`,
      [name],
    );
    const row = res.rows[0];
    if (!row) throw new FixtureError(`No fixture named "${name}" in mocks.fixtures.`, 404);
    return parsePayload(name, row.data);
  });
}

export async function readAllFixtures(): Promise<StaticFixtures> {
  return withClient(async (client) => {
    const { mocks } = resolveSchemas();
    const res = await client.query<FixtureInfo & { data: unknown }>(
      `select name, description, data from ${mocks}.fixtures order by name`,
    );
    const data: Record<string, BoardPayload> = {};
    for (const row of res.rows) data[row.name] = parsePayload(row.name, row.data);
    return { list: res.rows.map(({ name, description }) => ({ name, description })), data };
  });
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

let livePool: Pool | undefined;

/** One small pool for the live endpoints, created on first use and closed with the dev server. */
function getLivePool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new LiveScenarioError('DATABASE_URL is not set, so sb_app cannot be read.');
  }
  return (livePool ??= createPool({ max: 2 }));
}

/**
 * `/__fixtures-live/:name` and `/__fixtures-live/:name/version`. Read per request, never cached.
 * Returns false when the path is not a live path.
 */
export async function handleLive(
  pathname: string,
  res: ServerResponse,
  pool: () => Pool = getLivePool,
): Promise<boolean> {
  const match = /^\/__fixtures-live\/([^/]+)(\/version)?\/?$/.exec(pathname);
  if (!match) return false;
  try {
    const name = decodeURIComponent(match[1] as string);
    const schemas = liveSchemas();
    const payload = await readLiveScenario(pool(), schemas, name);
    const version = payloadVersion(payload);
    // The payload carries its own version and schema name, so the preview has no load/poll race.
    sendJson(
      res,
      200,
      match[2] ? { version } : payload,
      match[2] ? {} : { 'X-Live-Version': version, 'X-Live-Schema': schemas.raw.app },
    );
  } catch (err) {
    sendJson(res, err instanceof LiveScenarioError ? err.status : 500, {
      error: (err as Error).message,
    });
  }
  return true;
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'GET' && (await handleLive(url.pathname, res))) return;
  if (req.method !== 'GET' || !/^\/__fixtures(\/|$)/.test(url.pathname)) return next();
  try {
    const name = decodeURIComponent(url.pathname.slice('/__fixtures'.length).replace(/^\//, ''));
    sendJson(res, 200, name === '' ? await listFixtures() : await readFixture(name));
  } catch (err) {
    const status = err instanceof FixtureError ? err.status : 500;
    sendJson(res, status, { error: (err as Error).message });
  }
}

/**
 * `mode: 'serve'` adds the middleware; `mode: 'build'` emits __fixtures.json at build time.
 * The `define` tells the browser-side loader which one to use.
 */
export function fixturesPlugin(mode: 'serve' | 'build'): Plugin {
  return {
    name: 'teamboard-fixtures',
    config: () => ({ define: { __TB_FIXTURES_STATIC__: JSON.stringify(mode === 'build') } }),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next);
      });
      server.httpServer?.once('close', () => {
        void livePool?.end().catch(() => {});
        livePool = undefined;
      });
    },
    async generateBundle() {
      if (mode !== 'build') return;
      let fixtures: StaticFixtures;
      try {
        fixtures = await readAllFixtures();
      } catch (err) {
        this.error(
          `build-storybook needs the database to pre-render the fixtures into __fixtures.json. ${(err as Error).message}`,
        );
      }
      this.emitFile({
        type: 'asset',
        fileName: '__fixtures.json',
        source: JSON.stringify(fixtures),
      });
    },
  };
}
