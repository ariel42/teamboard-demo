/**
 * Vite plugin that serves the board fixtures stored in Postgres (`mocks.fixtures`) to stories.
 *
 *   dev server        GET /__fixtures          -> [{ name, description }]
 *                     GET /__fixtures/:name    -> BoardPayload (validated with boardPayloadSchema)
 *   storybook build   the same data is pre-rendered into /__fixtures.json (no DB needed to serve it)
 *
 * Connection: DATABASE_URL (required) and the optional DB_SCHEMA_PREFIX, like the rest of the repo.
 * Failures answer with HTTP 503 and `{ error }` so the story can show a readable error panel.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import pg from 'pg';
import type { Plugin } from 'vite';
import { boardPayloadSchema, resolveSchemas } from '@teamboard/db';
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

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
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
