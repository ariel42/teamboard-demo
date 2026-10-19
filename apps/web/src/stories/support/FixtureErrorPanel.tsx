/** Shown instead of a story when its database fixture could not be loaded. */
export function FixtureErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      data-testid="fixture-error"
      style={{
        margin: 24,
        padding: 20,
        border: '2px solid #b42318',
        borderRadius: 8,
        background: '#fff4f2',
        color: '#7a1b12',
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 640,
      }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>This story needs the database</h2>
      <p style={{ margin: '0 0 8px' }}>{message}</p>
      <p style={{ margin: 0, fontSize: 14 }}>
        Fixtures are read from <code>mocks.fixtures</code>. Check that <code>DATABASE_URL</code> is
        set, run <code>npm run db:setup</code>, then restart Storybook. Stories that use plain props
        keep working without a database.
      </p>
    </div>
  );
}
