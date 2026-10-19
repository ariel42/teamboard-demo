import { randomBytes } from 'node:crypto';
import { dropSchemas, runMigrations } from './migrate.ts';
import { createPool } from './pool.ts';
import type { Pool } from './pool.ts';
import { resolveSchemas } from './schema-names.ts';
import type { SchemaNames } from './schema-names.ts';

export interface TestSchema {
  pool: Pool;
  schemas: SchemaNames;
  prefix: string;
  /** Drops the throwaway schemas (cascade) and closes the pool. */
  drop(): Promise<void>;
}

/**
 * Test helper: a pool plus a fresh, uniquely prefixed set of schemas (e.g. `t1a2b3c4d_app`).
 * Migrated by default. Always call `drop()` in afterAll.
 */
export async function createTestSchema(options: { migrate?: boolean } = {}): Promise<TestSchema> {
  const prefix = `t${randomBytes(4).toString('hex')}_`;
  const schemas = resolveSchemas(prefix);
  const pool = createPool({ max: 4 });
  try {
    if (options.migrate !== false) await runMigrations(pool, schemas);
  } catch (err) {
    await dropSchemas(pool, schemas).catch(() => undefined);
    await pool.end();
    throw err;
  }
  return {
    pool,
    schemas,
    prefix,
    async drop() {
      try {
        await dropSchemas(pool, schemas);
      } finally {
        await pool.end();
      }
    },
  };
}
