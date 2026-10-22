import { runCli } from './run.ts';
import { migrateStep, seedStep, storybookStep } from './steps.ts';

await runCli(async (pool, schemas) => {
  await migrateStep(pool, schemas);
  await seedStep(pool, schemas);
  await storybookStep(pool);
});
