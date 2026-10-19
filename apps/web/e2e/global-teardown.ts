import { createPool, dropSchemas, resolveSchemas } from '@teamboard/db';

/** Drops the per-run schemas so the shared database is left as it was found. */
export default async function globalTeardown() {
  const prefix = process.env.E2E_SCHEMA_PREFIX;
  if (!prefix) return;
  const pool = createPool({ max: 1 });
  try {
    await dropSchemas(pool, resolveSchemas(prefix));
  } finally {
    await pool.end();
  }
}
