/** Toolbar "Data": where the stories get their board data from. */
export const DATA_SOURCES = ['fixtures', 'live'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** Today's behavior: JSON fixtures from mocks.fixtures. Keep this the default. */
export const DEFAULT_DATA_SOURCE: DataSource = 'fixtures';

export const LIVE_NOTICE_TEXT = 'Live schema: not built yet, showing fixtures';

/** Anything but an explicit 'live' means fixtures. */
export function resolveDataSource(value: unknown): DataSource {
  return value === 'live' ? 'live' : DEFAULT_DATA_SOURCE;
}

/** Small corner badge, shown only when "Live schema" is selected. Does not affect the layout. */
export function LiveNotice() {
  return (
    <div
      role="status"
      data-testid="live-data-notice"
      style={{
        position: 'fixed',
        insetBlockEnd: 8,
        insetInlineEnd: 8,
        zIndex: 1000,
        padding: '2px 8px',
        border: '1px solid #b54708',
        borderRadius: 4,
        background: '#fffaeb',
        color: '#7a2e0e',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        pointerEvents: 'none',
      }}
    >
      {LIVE_NOTICE_TEXT}
    </div>
  );
}
