import { runMigrations, dropSchemas } from '../migrate.ts';
import type { Pool } from '../pool.ts';
import { seedAll } from '../seed/seed.ts';
import type { SchemaNames } from '../schema-names.ts';

export async function migrateStep(pool: Pool, schemas: SchemaNames) {
  const r = await runMigrations(pool, schemas);
  if (r.applied.length === 0) console.log(`migrate: up to date (${r.skipped.length} applied)`);
  else console.log(`migrate: applied ${r.applied.join(', ')}`);
}

export async function seedStep(pool: Pool, schemas: SchemaNames) {
  const r = await seedAll(pool, schemas);
  console.log(
    `seed: ${r.flags} flags, ${r.settings} settings, ${r.fixtures} fixtures, starter board ${r.starterBoard}`,
  );
}

export async function resetStep(pool: Pool, schemas: SchemaNames) {
  await dropSchemas(pool, schemas);
  console.log(`reset: dropped ${Object.values(schemas.raw).join(', ')}`);
}
