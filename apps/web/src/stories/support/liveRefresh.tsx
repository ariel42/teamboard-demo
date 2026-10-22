import { useEffect, useRef } from 'react';
import { fetchLiveVersion } from './fixtures';

export const LIVE_POLL_MS = 2000;
/** Consecutive failed polls (404, 503, server down) after which polling gives up. */
export const LIVE_MAX_FAILURES = 5;

/**
 * Polls the version of a live scenario and calls `onChange` once when it differs from
 * `initialVersion`. Without an `initialVersion` (the load failed) the first successful poll counts
 * as a change: the schema was seeded, so the story should reload. A failed poll (server restarting,
 * 503 not seeded, 404) is tolerated, but after LIVE_MAX_FAILURES in a row polling stops for good
 * (reload the story to start again). Polling is paused while the tab is hidden (no request, and it
 * does not count as a failure). Returns the stop function.
 */
export function startLivePolling(options: {
  initialVersion?: string;
  fetchVersion: () => Promise<string>;
  onChange: () => void;
  intervalMs?: number;
}): () => void {
  const { initialVersion, fetchVersion, onChange, intervalMs = LIVE_POLL_MS } = options;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  const tick = async () => {
    if (typeof document !== 'undefined' && document.hidden) {
      timer = setTimeout(() => void tick(), intervalMs);
      return;
    }
    try {
      const version = await fetchVersion();
      if (stopped) return;
      failures = 0;
      if (initialVersion === undefined || version !== initialVersion) {
        stopped = true;
        onChange();
        return;
      }
    } catch {
      if (stopped) return;
      if (++failures >= LIVE_MAX_FAILURES) {
        stopped = true;
        return;
      }
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };
  timer = setTimeout(() => void tick(), intervalMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/** Value of the iframe `globals` URL parameter for the plain (string) globals, keeps the others. */
export function globalsParam(current: string | null, globals: Record<string, unknown>): string {
  const merged = new Map<string, string>();
  for (const pair of (current ?? '').split(';')) {
    const [k, ...v] = pair.split(':');
    if (k) merged.set(k, v.join(':'));
  }
  for (const [k, v] of Object.entries(globals)) {
    if (typeof v === 'string' && /^[\w .-]+$/.test(v)) merged.set(k, v);
  }
  return [...merged].map(([k, v]) => `${k}:${v}`).join(';');
}

/** Reloads the preview iframe so the story re-runs with fresh data; globals stay in the URL. */
export function reloadPreview(globals: Record<string, unknown>) {
  const url = new URL(window.location.href);
  url.searchParams.set('globals', globalsParam(url.searchParams.get('globals'), globals));
  window.location.replace(url.toString());
}

const RECOVER_KEY = 'tb-live-recover';
const RECOVER_MIN_MS = 10_000;

/** Error recovery reloads at most once per story per 10 s, so a flapping server cannot loop. */
function mayRecover(id: string, now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(`${RECOVER_KEY}:${id}`) ?? 0);
    if (now - last < RECOVER_MIN_MS) return false;
    sessionStorage.setItem(`${RECOVER_KEY}:${id}`, String(now));
  } catch {
    // no sessionStorage: allow the reload
  }
  return true;
}

/**
 * Renders nothing; polls while mounted (dev server, one story) and reloads on a change. With no
 * `version` (the load failed) it waits for the schema to become readable and reloads once.
 */
export function LiveRefresh({
  id,
  name,
  version,
  globals,
}: {
  id: string;
  name: string;
  version?: string;
  globals: Record<string, unknown>;
}) {
  const globalsRef = useRef(globals);
  useEffect(() => {
    globalsRef.current = globals;
  }, [globals]);
  useEffect(
    () =>
      startLivePolling({
        initialVersion: version,
        fetchVersion: () => fetchLiveVersion(name),
        onChange: () => {
          if (version === undefined && !mayRecover(id)) return;
          reloadPreview(globalsRef.current);
        },
      }),
    [id, name, version],
  );
  return null;
}
