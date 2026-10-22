/**
 * Vite plugin that serves the Storybook board data from the `sb_` mirror schemas (sb_app/sb_config).
 * That is the only data source: `npm run db:setup` fills it, `update sb_app.cards ...` edits it.
 *
 *   dev server        GET /__fixtures/:name          -> BoardPayload built live from sb_app
 *                     GET /__fixtures/:name/version  -> { version } (md5 of that payload)
 *   storybook build   every scenario is read from sb_ once, at build time, and written to
 *                     /__fixtures.json ({ name: BoardPayload }); the built Storybook needs no database
 *
 * Connection: DATABASE_URL (required). Failures answer with HTTP 503 and `{ error }` (with the
 * `npm run db:setup` hint) so the story can show a readable message.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  buildFixtures,
  createPool,
  liveResponse,
  LiveScenarioError,
  liveSchemas,
  readLiveScenario,
  SEED_HINT,
} from '@teamboard/db';
import type { BoardPayload, Pool } from '@teamboard/db';

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

/** One small pool for the endpoints, created on first use and closed with the dev server. */
function getLivePool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new LiveScenarioError(`DATABASE_URL is not set, so sb_app cannot be read. ${SEED_HINT}`);
  }
  return (livePool ??= createPool({ max: 2 }));
}

const FIXTURE_PATH = /^\/__fixtures\/[^/]+(\/version)?\/?$/;

/** `/__fixtures/...`: read per request, never cached. */
async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  // Decided synchronously, so every other request reaches next() exactly as before.
  if (req.method !== 'GET' || !FIXTURE_PATH.test(url.pathname)) return next();
  const live = await liveResponse(url.pathname, getLivePool);
  if (live) sendJson(res, live.status, live.body, live.headers);
}

/** Reads every scenario from sb_app (or the test prefix) for `__fixtures.json`. */
export async function readAllScenarios(): Promise<Record<string, BoardPayload>> {
  const pool = getLivePool();
  try {
    const schemas = liveSchemas();
    const data: Record<string, BoardPayload> = {};
    for (const { name } of buildFixtures())
      data[name] = await readLiveScenario(pool, schemas, name);
    return data;
  } finally {
    await pool.end().catch(() => {});
    livePool = undefined;
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
      let data: Record<string, BoardPayload>;
      try {
        data = await readAllScenarios();
      } catch (err) {
        this.error(
          `build-storybook reads the scenarios from the sb_ schemas into __fixtures.json, so it needs the database. ${(err as Error).message}`,
        );
      }
      this.emitFile({ type: 'asset', fileName: '__fixtures.json', source: JSON.stringify(data) });
    },
  };
}
