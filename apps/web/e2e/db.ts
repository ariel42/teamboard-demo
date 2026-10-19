import { createPool, resolveSchemas } from '@teamboard/db';

export const schemas = () => resolveSchemas(process.env.E2E_SCHEMA_PREFIX);

/** Runs SQL against the run's throwaway schemas; `{{app}}` / `{{config}}` become the quoted schema names. */
export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = createPool({ max: 1 });
  try {
    const { app, config } = schemas();
    const result = await pool.query(
      text.replaceAll('{{app}}', app).replaceAll('{{config}}', config),
      params,
    );
    return result.rows as T[];
  } finally {
    await pool.end();
  }
}
