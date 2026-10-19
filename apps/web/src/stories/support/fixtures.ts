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

export interface LoadedFixture {
  fixture?: BoardPayload;
  fixtureError?: string;
}

/** Story `loaders` result: never throws, so a missing DB renders an error panel instead. */
export async function fixtureLoader(name: string): Promise<LoadedFixture> {
  try {
    return { fixture: await loadFixture(name) };
  } catch (error) {
    return { fixtureError: `Fixture "${name}": ${(error as Error).message}` };
  }
}
