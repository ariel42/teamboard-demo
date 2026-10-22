import { randomBytes } from 'node:crypto';
import {
  createPool,
  dropSchemas,
  resolveSchemas,
  runMigrations,
  seedStorybook,
} from '@teamboard/db';

/**
 * Vitest globalSetup of the `storybook` project (`npm run test:ui`). The live-data stories read
 * the sb_ mirror through the Vite server's `/__fixtures-live`. So the run seeds its own throwaway
 * `t<hex>_sb_` prefix, points TEAMBOARD_STORYBOOK_PREFIX at it (the endpoint reads that variable on
 * every request) and drops it afterwards. The real `sb_*` schemas are never touched or required.
 */
export default async function setup() {
  const pool = createPool({ max: 2 });
  const sb = resolveSchemas(`t${randomBytes(4).toString('hex')}_sb_`);
  const saved = process.env.TEAMBOARD_STORYBOOK_PREFIX;
  try {
    await runMigrations(pool, sb);
    await seedStorybook(pool, sb);
  } catch (err) {
    await dropSchemas(pool, sb).catch(() => undefined);
    await pool.end();
    throw err;
  }
  process.env.TEAMBOARD_STORYBOOK_PREFIX = sb.prefix;
  return async () => {
    if (saved === undefined) delete process.env.TEAMBOARD_STORYBOOK_PREFIX;
    else process.env.TEAMBOARD_STORYBOOK_PREFIX = saved;
    try {
      await dropSchemas(pool, sb);
    } finally {
      await pool.end();
    }
  };
}
