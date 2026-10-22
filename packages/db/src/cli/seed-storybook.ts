import { runMigrations } from '../migrate.ts';
import { resetStorybook, seedStorybook, STORYBOOK_PREFIX } from '../seed/storybook.ts';
import { runCli } from './run.ts';

/**
 * Seeds (or, with --reset, recreates) the Storybook mirror schemas `sb_app` / `sb_config`.
 * The prefix is fixed to `sb_` on purpose: DB_SCHEMA_PREFIX is ignored so the real schemas are
 * never touched by this command.
 */
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
}, STORYBOOK_PREFIX);
