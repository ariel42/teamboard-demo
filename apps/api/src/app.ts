import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { createRepo, resolveSchemas } from '@teamboard/db';
import type { Pool } from '@teamboard/db';
import { registerErrorHandling } from './errors.ts';
import { registerRoutes } from './routes/index.ts';

export interface BuildAppOptions {
  pool: Pool;
  /** Schema prefix (DB_SCHEMA_PREFIX); tests pass a throwaway one. */
  prefix?: string;
  logger?: boolean;
  env?: { kind?: string; user?: string };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1_048_576 });
  const repo = createRepo(options.pool, resolveSchemas(options.prefix));

  await app.register(cors, {
    origin: true, // reflect the request origin
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  registerErrorHandling(app);
  registerRoutes(app, {
    repo,
    env: {
      kind: options.env?.kind ?? process.env.DEVENV_KIND ?? 'unknown',
      user: options.env?.user ?? process.env.DEVENV_USER ?? 'unknown',
    },
  });
  return app;
}
