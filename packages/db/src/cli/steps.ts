import { runMigrations, dropSchemas } from '../migrate.ts';
import type { Pool } from '../pool.ts';
import { seedAll } from '../seed/seed.ts';
import { liveSchemas } from '../seed/storybook-live.ts';
import { seedStorybook } from '../seed/storybook.ts';
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

/**
 * Storybook mirror: migrate and seed `sb_*` (insert-only, so edits survive). Run by `db:setup`
 * after the other steps. The prefix is the fixed `sb_` whatever DB_SCHEMA_PREFIX says; only the
 * tests override it (TEAMBOARD_STORYBOOK_PREFIX, a throwaway `t<hex>_sb_` prefix).
 */
export async function storybookStep(pool: Pool) {
  const sb = liveSchemas();
  await runMigrations(pool, sb);
  const results = await seedStorybook(pool, sb);
  const created = results.filter((r) => r.board === 'created').length;
  console.log(`storybook: ${sb.raw.app} ${results.length} scenarios (${created} created)`);
}

export async function resetStep(pool: Pool, schemas: SchemaNames) {
  await dropSchemas(pool, schemas);
  console.log(`reset: dropped ${Object.values(schemas.raw).join(', ')}`);
}
