import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness } from './helpers.ts';
import type { Harness } from './helpers.ts';

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'up' });
  });
});

describe('GET /api/config', () => {
  it('returns flags, settings and the environment', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      flags: { card_comments: true, due_dates: true, wip_limits: false, compact_cards: false },
      settings: { app_title: 'Teamboard', wip_limit: 5, default_board: 'Sprint 24' },
      env: { kind: 'test-kind', user: 'test-user' },
    });
  });
});

describe('PATCH /api/config/flags/:key', () => {
  it('toggles a flag and persists it', async () => {
    const on = await h.app.inject({
      method: 'PATCH',
      url: '/api/config/flags/wip_limits',
      payload: { enabled: true },
    });
    expect(on.statusCode).toBe(200);
    expect(on.json()).toMatchObject({ key: 'wip_limits', enabled: true });
    const cfg = await h.app.inject({ method: 'GET', url: '/api/config' });
    expect(cfg.json().flags.wip_limits).toBe(true);

    const off = await h.app.inject({
      method: 'PATCH',
      url: '/api/config/flags/wip_limits',
      payload: { enabled: false },
    });
    expect(off.json().enabled).toBe(false);
    expect(
      (await h.app.inject({ method: 'GET', url: '/api/config' })).json().flags.wip_limits,
    ).toBe(false);
  });

  it('404s for an unknown flag', async () => {
    const res = await h.app.inject({
      method: 'PATCH',
      url: '/api/config/flags/nope',
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('400s for invalid bodies', async () => {
    for (const payload of [{}, { enabled: 'yes' }, { enabled: true, extra: 1 }]) {
      const res = await h.app.inject({
        method: 'PATCH',
        url: '/api/config/flags/wip_limits',
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('validation_error');
    }
    const noBody = await h.app.inject({ method: 'PATCH', url: '/api/config/flags/wip_limits' });
    expect(noBody.statusCode).toBe(400);
  });

  it('400s for an invalid flag key', async () => {
    const res = await h.app.inject({
      method: 'PATCH',
      url: '/api/config/flags/Bad-Key',
      payload: { enabled: true },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/users', () => {
  it('lists the team', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/users' });
    expect(res.statusCode).toBe(200);
    const users = res.json<{ name: string; initials: string; color: string }[]>();
    expect(users).toHaveLength(5);
    expect(users.map((u) => u.name)).toContain('Maya Chen');
    expect(users[0]).toEqual(
      expect.objectContaining({ id: expect.any(Number), initials: expect.any(String) }),
    );
  });
});

describe('cross-cutting behaviour', () => {
  it('reflects the request origin for CORS', async () => {
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('answers preflight for PATCH and DELETE', async () => {
    for (const method of ['PATCH', 'DELETE']) {
      const res = await h.app.inject({
        method: 'OPTIONS',
        url: '/api/cards/1',
        headers: {
          origin: 'http://example.test',
          'access-control-request-method': method,
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('http://example.test');
      expect(String(res.headers['access-control-allow-methods'])).toContain(method);
    }
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.json().error).toBe('not_found');
  });

  it('returns JSON 400 for malformed JSON', async () => {
    const res = await h.app.inject({
      method: 'PATCH',
      url: '/api/config/flags/wip_limits',
      headers: { 'content-type': 'application/json' },
      payload: '{"enabled": tru',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_json');
  });

  it('returns 503 on /health when the database is down', async () => {
    const { buildApp } = await import('../src/app.ts');
    const { createPool } = await import('@teamboard/db');
    const pool = createPool({ connectionString: 'postgres://x:y@127.0.0.1:1/none', max: 1 });
    const app = await buildApp({ pool });
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ status: 'error', db: 'down' });
    } finally {
      await app.close();
      await pool.end();
    }
  });
});
