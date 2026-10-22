import type { BoardPayload } from '../../lib/types';

/** Set by the fixtures Vite plugin: true in a static `build-storybook`, where no DB is available. */
declare const __TB_FIXTURES_STATIC__: boolean;

export interface FixtureInfo {
  name: string;
  description: string;
}

/** Names of the rows in mocks.fixtures (seeded by `npm run db:setup`). */
export const FIXTURE_NAMES = [
  'typical',
  'empty',
  'overloaded',
  'long-text',
  'rtl-hebrew',
  'all-priorities',
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

interface StaticFixtures {
  list: FixtureInfo[];
  data: Record<string, BoardPayload>;
}

let staticCache: Promise<StaticFixtures> | undefined;

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error(`Cannot reach the Storybook dev server at ${url}.`);
  }
  const body = (await res.json().catch(() => null)) as T | { error?: string } | null;
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && body.error
        ? body.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

const loadStatic = () => (staticCache ??= fetchJson<StaticFixtures>('__fixtures.json'));

/**
 * Loads a board fixture from the database (through the dev-server middleware `/__fixtures/:name`)
 * or, in a built Storybook, from the `__fixtures.json` pre-rendered at build time.
 * Always returns a fresh copy, so stories can mutate it.
 */
export async function loadFixture(name: string): Promise<BoardPayload> {
  if (__TB_FIXTURES_STATIC__) {
    const all = await loadStatic();
    const data = all.data[name];
    if (!data) throw new Error(`No fixture named "${name}" was pre-rendered into __fixtures.json.`);
    return structuredClone(data);
  }
  return fetchJson<BoardPayload>(`__fixtures/${encodeURIComponent(name)}`);
}

export async function listFixtures(): Promise<FixtureInfo[]> {
  if (__TB_FIXTURES_STATIC__) return (await loadStatic()).list;
  return fetchJson<FixtureInfo[]>('__fixtures');
}

/** What the toolbar "Data: Live schema" mode did for a story (absent in the Fixtures mode). */
export interface LiveInfo {
  /** ok: payload came from sb_app. error: the endpoint failed, fixtures are shown instead.
   *  static: built Storybook without a dev server, fixtures are shown. */
  state: 'ok' | 'error' | 'static';
  /** Scenario (fixture) name; the key for /__fixtures-live/:name. */
  name: string;
  /** Schema the payload was read from, e.g. sb_app. */
  schema: string;
  /** md5 of the payload as served; auto-refresh polls /version and reloads when it changes. */
  version?: string;
  error?: string;
}

export interface LoadedFixture {
  fixture?: BoardPayload;
  fixtureError?: string;
  live?: LiveInfo;
}

/** Live schema of the real mirror; the endpoint reports the actual one (tests use a throwaway). */
export const LIVE_SCHEMA = 'sb_app';

/** The scenario payload built live from sb_app, with the version header of that same read. */
export async function loadLiveFixture(
  name: string,
): Promise<{ fixture: BoardPayload; version?: string; schema: string }> {
  const url = `__fixtures-live/${encodeURIComponent(name)}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error(`Cannot reach the Storybook dev server at ${url}.`);
  }
  const body = (await res.json().catch(() => null)) as BoardPayload | { error?: string } | null;
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && body.error
        ? body.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return {
    fixture: body as BoardPayload,
    version: res.headers.get('X-Live-Version') ?? undefined,
    schema: res.headers.get('X-Live-Schema') ?? LIVE_SCHEMA,
  };
}

/** Current version of the live payload (cheap md5 from the dev server). */
export async function fetchLiveVersion(name: string): Promise<string> {
  const res = await fetch(`__fixtures-live/${encodeURIComponent(name)}/version`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Version request failed with status ${res.status}`);
  return ((await res.json()) as { version: string }).version;
}

/**
 * Story `loaders` result: never throws, so a missing DB renders an error panel instead.
 * With `source: 'live'` it reads the scenario from sb_app instead and falls back to the fixture
 * (with `live.state` 'error' or 'static') when that is not possible.
 */
export async function fixtureLoader(
  name: string,
  source: 'fixtures' | 'live' = 'fixtures',
): Promise<LoadedFixture> {
  if (source === 'live') {
    if (__TB_FIXTURES_STATIC__) {
      return {
        ...(await fixtureLoader(name)),
        live: { state: 'static', name, schema: LIVE_SCHEMA },
      };
    }
    try {
      const live = await loadLiveFixture(name);
      return {
        fixture: live.fixture,
        live: { state: 'ok', name, schema: live.schema, version: live.version },
      };
    } catch (error) {
      return {
        ...(await fixtureLoader(name)),
        live: { state: 'error', name, schema: LIVE_SCHEMA, error: (error as Error).message },
      };
    }
  }
  try {
    return { fixture: await loadFixture(name) };
  } catch (error) {
    return { fixtureError: `Fixture "${name}": ${(error as Error).message}` };
  }
}
