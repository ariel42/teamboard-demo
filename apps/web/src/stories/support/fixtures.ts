import type { BoardPayload } from '../../lib/types';

/** Set by the fixtures Vite plugin: true in a static `build-storybook`, where no DB is available. */
declare const __TB_FIXTURES_STATIC__: boolean;

/** Scenario names: the boards in sb_app (seeded by `npm run db:setup`). */
export const FIXTURE_NAMES = [
  'typical',
  'empty',
  'overloaded',
  'long-text',
  'rtl-hebrew',
  'all-priorities',
] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

/** Where the scenario came from, for the auto-refresh (absent in a static build). */
export interface LiveInfo {
  /** Scenario name; the key for /__fixtures/:name. */
  name: string;
  /** md5 of the payload as served; auto-refresh polls /version and reloads when it changes. */
  version?: string;
}

export interface LoadedFixture {
  fixture?: BoardPayload;
  /** One readable message (it carries the `npm run db:setup` hint) when the scenario could not be read. */
  fixtureError?: string;
  live?: LiveInfo;
}

async function fetchJson(url: string): Promise<{ body: unknown; res: Response }> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new Error(`Cannot reach the Storybook server at ${url}.`);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return { body, res };
}

let staticCache: Promise<Record<string, BoardPayload>> | undefined;
const loadStatic = () =>
  (staticCache ??= fetchJson('__fixtures.json').then(
    (r) => r.body as Record<string, BoardPayload>,
  ));

/**
 * Reads one scenario: from the dev server (`/__fixtures/:name`, built live from sb_app) or, in a
 * built Storybook, from the `__fixtures.json` baked at build time. Returns a fresh copy, so
 * stories can mutate it.
 */
export async function loadFixture(
  name: string,
): Promise<{ fixture: BoardPayload; version?: string }> {
  if (__TB_FIXTURES_STATIC__) {
    const data = (await loadStatic())[name];
    if (!data) throw new Error(`No scenario named "${name}" was baked into __fixtures.json.`);
    return { fixture: structuredClone(data) };
  }
  const { body, res } = await fetchJson(`__fixtures/${encodeURIComponent(name)}`);
  return { fixture: body as BoardPayload, version: res.headers.get('X-Live-Version') ?? undefined };
}

/** Current version of a scenario (cheap md5 from the dev server). */
export async function fetchLiveVersion(name: string): Promise<string> {
  const { body } = await fetchJson(`__fixtures/${encodeURIComponent(name)}/version`);
  return (body as { version: string }).version;
}

/**
 * Story `loaders` result: never throws, so a missing or unseeded database renders one inline
 * message instead of a broken story.
 */
export async function fixtureLoader(name: string): Promise<LoadedFixture> {
  try {
    const { fixture, version } = await loadFixture(name);
    return { fixture, live: __TB_FIXTURES_STATIC__ ? undefined : { name, version } };
  } catch (error) {
    return {
      fixtureError: `Scenario "${name}": ${(error as Error).message}`,
      live: __TB_FIXTURES_STATIC__ ? undefined : { name },
    };
  }
}
