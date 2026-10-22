/**
 * Postgres schema naming. All schema names are `${DB_SCHEMA_PREFIX ?? ''}app` etc. so tests can
 * work in throwaway schemas without touching a developer's data.
 */

export interface SchemaNames {
  prefix: string;
  /** Already double-quoted, safe to interpolate into SQL. */
  app: string;
  config: string;
  /** Legacy: only migrations 001/002 use it (002 drops the schema); nothing reads or writes it. */
  mocks: string;
  /** Unquoted names, for pg_catalog lookups and logging. */
  raw: { app: string; config: string; mocks: string };
}

const PREFIX_RE = /^[a-z_][a-z0-9_]{0,40}$/;

export function resolveSchemas(prefix: string = process.env.DB_SCHEMA_PREFIX ?? ''): SchemaNames {
  if (prefix !== '' && !PREFIX_RE.test(prefix)) {
    throw new Error(
      `Invalid DB_SCHEMA_PREFIX "${prefix}": use lowercase letters, digits and underscores, starting with a letter or underscore.`,
    );
  }
  const raw = { app: `${prefix}app`, config: `${prefix}config`, mocks: `${prefix}mocks` };
  return {
    prefix,
    app: `"${raw.app}"`,
    config: `"${raw.config}"`,
    mocks: `"${raw.mocks}"`,
    raw,
  };
}
