import { restoreFixturesTable } from '../migrate.ts';
import { runCli } from './run.ts';

await runCli(async (pool, schemas) => {
  await restoreFixturesTable(pool, schemas);
  console.log(
    `restore-fixtures: ${schemas.raw.mocks}.fixtures recreated (empty), 002 forgotten. Now check out fixtures-main and run db:setup.`,
  );
});
