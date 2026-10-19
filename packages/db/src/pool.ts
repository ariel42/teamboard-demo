import pg from 'pg';

export type Pool = pg.Pool;

export interface CreatePoolOptions {
  connectionString?: string;
  max?: number;
}

/** Creates a pg pool from DATABASE_URL (the only connection setting the app reads). */
export function createPool(options: CreatePoolOptions = {}): Pool {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. The environment provides it; see README.md.');
  }
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client dropping must not crash the process.
  pool.on('error', (err) => {
    console.error('[db] idle client error:', err.message);
  });
  return pool;
}
