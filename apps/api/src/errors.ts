import type { FastifyError, FastifyInstance } from 'fastify';
import { DomainError } from '@teamboard/db';
import { ZodError } from 'zod';

export interface ErrorBody {
  error: string;
  message: string;
  details?: { path: string; message: string }[];
}

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((req, reply) => {
    const body: ErrorBody = {
      error: 'not_found',
      message: `Route ${req.method} ${req.url.split('?')[0]} not found`,
    };
    return reply.code(404).send(body);
  });

  app.setErrorHandler((err: FastifyError | Error, req, reply) => {
    if (err instanceof ZodError) {
      const body: ErrorBody = {
        error: 'validation_error',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
      return reply.code(400).send(body);
    }
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: err.code, message: err.message });
    }
    if (err instanceof DomainError) {
      const status = err.code === 'not_found' ? 404 : 422;
      return reply.code(status).send({ error: err.code, message: err.message });
    }
    const fe = err as FastifyError;
    if (typeof fe.statusCode === 'number' && fe.statusCode >= 400 && fe.statusCode < 500) {
      const code =
        fe.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || fe.code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
          ? 'invalid_json'
          : fe.statusCode === 413
            ? 'payload_too_large'
            : fe.statusCode === 415
              ? 'unsupported_media_type'
              : 'bad_request';
      return reply.code(fe.statusCode).send({ error: code, message: fe.message });
    }
    req.log.error({ err }, 'unhandled error');
    return reply
      .code(500)
      .send({ error: 'internal_error', message: 'Internal server error' } satisfies ErrorBody);
  });
}
