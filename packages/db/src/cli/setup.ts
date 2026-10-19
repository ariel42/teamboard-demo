import { runCli } from './run.ts';
import { migrateStep, seedStep } from './steps.ts';

await runCli(async (pool, schemas) => {
  await migrateStep(pool, schemas);
  await seedStep(pool, schemas);
});
