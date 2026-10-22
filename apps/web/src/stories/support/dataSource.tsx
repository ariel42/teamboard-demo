import { useEffect, useRef } from 'react';
import { fetchLiveVersion, LIVE_SCHEMA } from './fixtures';
import type { LiveInfo } from './fixtures';

/** Toolbar "Data": where the stories get their board data from. */
export const DATA_SOURCES = ['fixtures', 'live'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** Today's behavior: JSON fixtures from mocks.fixtures. Keep this the default. */
export const DEFAULT_DATA_SOURCE: DataSource = 'fixtures';

/** Anything but an explicit 'live' means fixtures. */
export function resolveDataSource(value: unknown): DataSource {
  return value === 'live' ? 'live' : DEFAULT_DATA_SOURCE;
}

export const LIVE_STATIC_TEXT = 'Live schema needs the dev server';
export const LIVE_POLL_MS = 2000;

/** Text of the live badge for one story (state comes from the loader, see LiveInfo). */
export function liveBadgeText(live: LiveInfo | undefined): string {
  if (!live) return `Live: ${LIVE_SCHEMA} (this story uses no board data)`;
  if (live.state === 'static') return LIVE_STATIC_TEXT;
  if (live.state === 'error')
    return `Live: ${live.schema} failed, showing fixtures. ${live.error ?? ''}`.trim();
  return `Live: ${live.schema}`;
}

/** Small corner badge, shown only when "Live schema" is selected. Does not affect the layout. */
export function LiveBadge({ live }: { live?: LiveInfo }) {
  const bad = live?.state === 'error';
  return (
    <div
      role="status"
      data-testid="live-data-badge"
      data-state={live?.state ?? 'none'}
      style={{
        position: 'fixed',
        insetBlockEnd: 8,
        insetInlineEnd: 8,
        zIndex: 1000,
        maxWidth: 'min(520px, calc(100vw - 16px))',
        padding: '2px 8px',
        border: `1px solid ${bad ? '#b42318' : '#067647'}`,
        borderRadius: 4,
        background: bad ? '#fef3f2' : '#ecfdf3',
        color: bad ? '#7a271a' : '#054f31',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        pointerEvents: 'none',
      }}
    >
      {liveBadgeText(live)}
    </div>
  );
}

/**
 * Polls the version of a live scenario and calls `onChange` once when it differs from
 * `initialVersion`. A failed poll (server restarting) is ignored. Returns the stop function.
 */
export function startLivePolling(options: {
  initialVersion: string;
  fetchVersion: () => Promise<string>;
  onChange: () => void;
  intervalMs?: number;
}): () => void {
  const { initialVersion, fetchVersion, onChange, intervalMs = LIVE_POLL_MS } = options;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      const version = await fetchVersion();
      if (stopped) return;
      if (version !== initialVersion) {
        stopped = true;
        onChange();
        return;
      }
    } catch {
      // keep polling
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

/** Renders nothing; polls while mounted (live mode, one story) and reloads on a change. */
export function LiveRefresh({
  name,
  version,
  globals,
}: {
  name: string;
  version: string;
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
        onChange: () => reloadPreview(globalsRef.current),
      }),
    [name, version],
  );
  return null;
}
