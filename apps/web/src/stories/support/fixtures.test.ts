import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const board = { board: { id: 1, name: 'B' }, users: [], columns: [] };

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...init.headers },
    status: init.status ?? 200,
  });
}

/** A fresh module per test: loadStatic keeps its promise in module state. */
async function load(isStatic: boolean) {
  vi.resetModules();
  vi.stubGlobal('__TB_FIXTURES_STATIC__', isStatic);
  return import('./fixtures');
}

describe('fixtures loader', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('live: carries the X-Live-Version for the auto-refresh', async () => {
    vi.mocked(fetch).mockResolvedValue(json(board, { headers: { 'X-Live-Version': 'v1' } }));
    const { fixtureLoader } = await load(false);
    const out = await fixtureLoader('typical');
    expect(out.live).toEqual({ name: 'typical', version: 'v1' });
    expect(out.fixtureError).toBeUndefined();
  });

  it('live: without an X-Live-Version header there is no auto-refresh (no reload loop)', async () => {
    vi.mocked(fetch).mockResolvedValue(json(board));
    const { fixtureLoader } = await load(false);
    const out = await fixtureLoader('typical');
    expect(out.fixture).toBeDefined();
    expect(out.live).toBeUndefined();
  });

  it('live: an error keeps polling for recovery (name, no version) and shows the hint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      json(
        { error: 'Run "npm run db:setup" to create and fill the sb_ schemas.' },
        { status: 503 },
      ),
    );
    const { fixtureLoader } = await load(false);
    const out = await fixtureLoader('typical');
    expect(out.fixtureError).toContain('npm run db:setup');
    expect(out.live).toEqual({ name: 'typical' });
  });

  it('fetchLiveVersion rejects an answer without a version', async () => {
    vi.mocked(fetch).mockResolvedValue(json({}));
    const { fetchLiveVersion } = await load(false);
    await expect(fetchLiveVersion('typical')).rejects.toThrow(/no version/);
  });

  it('static: a failed __fixtures.json fetch is not cached, the next load retries', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ error: 'nope' }, { status: 404 }))
      .mockResolvedValueOnce(json({ typical: board }));
    const { loadFixture } = await load(true);
    await expect(loadFixture('typical')).rejects.toThrow('nope');
    const ok = await loadFixture('typical');
    expect(ok.fixture).toEqual(board);
    expect(fetch).toHaveBeenCalledTimes(2);
    await loadFixture('typical');
    expect(fetch).toHaveBeenCalledTimes(2); // a success is cached
  });
});
