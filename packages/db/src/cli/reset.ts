import { runCli } from './run.ts';
import { migrateStep, resetStep, seedStep } from './steps.ts';

await runCli(async (pool, schemas) => {
  await resetStep(pool, schemas);
  await migrateStep(pool, schemas);
  await seedStep(pool, schemas);
});
