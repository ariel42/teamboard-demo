import { createPool } from '../pool.ts';
import type { Pool } from '../pool.ts';
import { resolveSchemas } from '../schema-names.ts';
import type { SchemaNames } from '../schema-names.ts';

/** Shared wrapper for the db:* scripts: pool lifecycle and short, secret-free error messages. */
export async function runCli(main: (pool: Pool, schemas: SchemaNames) => Promise<void>) {
  let pool: Pool | undefined;
  try {
    const schemas = resolveSchemas();
    pool = createPool({ max: 2 });
    await main(pool, schemas);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`db: ${message}`);
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|password|authentication/i.test(message)) {
      console.error('db: cannot reach the database; check DATABASE_URL (run `npm run doctor`).');
    }
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
