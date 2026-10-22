import { runMigrations } from '../migrate.ts';
import {
  isStorybookPrefix,
  resetStorybook,
  seedStorybook,
  STORYBOOK_PREFIX,
} from '../seed/storybook.ts';
import { runCli } from './run.ts';

/**
 * Seeds (or, with --reset, recreates) the Storybook mirror schemas `sb_app` / `sb_config`.
 * The prefix is fixed to `sb_` on purpose: DB_SCHEMA_PREFIX is ignored so the real schemas are
 * never touched by this command. Only the tests set TEAMBOARD_STORYBOOK_PREFIX (a `t<hex>_sb_`
 * throwaway prefix) so they never touch the real `sb_*` schemas; other values are rejected.
 */
const prefix = process.env.TEAMBOARD_STORYBOOK_PREFIX || STORYBOOK_PREFIX;
if (!isStorybookPrefix(prefix)) {
  console.error(`db: TEAMBOARD_STORYBOOK_PREFIX "${prefix}" is not a test prefix.`);
  process.exit(1);
}

const reset = process.argv.includes('--reset');

await runCli(async (pool, schemas) => {
  let results;
  if (reset) {
    results = await resetStorybook(pool, schemas);
    console.log(`storybook: reset ${Object.values(schemas.raw).join(', ')}`);
  } else {
    const m = await runMigrations(pool, schemas);
    console.log(`storybook: migrate ${m.applied.length ? m.applied.join(', ') : 'up to date'}`);
    results = await seedStorybook(pool, schemas);
  }
  for (const r of results)
    console.log(`storybook: ${r.scenario} -> board ${r.boardId} (${r.board})`);
}, prefix);
