import type { FastifyInstance } from 'fastify';
import type { AppConfig, Repo } from '@teamboard/db';
import { notFound } from '../errors.ts';
import {
  cardPatchBody,
  flagBody,
  flagParams,
  idParams,
  newCardBody,
  newCommentBody,
} from '../schemas.ts';

export interface RouteDeps {
  repo: Repo;
  env: { kind: string; user: string };
}

export function registerRoutes(app: FastifyInstance, { repo, env }: RouteDeps): void {
  app.get('/api/health', async (_req, reply) => {
    const ok = await repo.ping().catch(() => false);
    return reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'error', db: ok ? 'up' : 'down' });
  });

  app.get('/api/config', async (): Promise<AppConfig> => {
    const [flags, settings] = await Promise.all([repo.getFlags(), repo.getSettings()]);
    return { flags, settings, env };
  });

  app.patch('/api/config/flags/:key', async (req) => {
    const { key } = flagParams.parse(req.params);
    const { enabled } = flagBody.parse(req.body);
    const flag = await repo.setFlag(key, enabled);
    if (!flag) throw notFound(`Feature flag "${key}"`);
    return flag;
  });

  app.get('/api/users', async () => repo.listUsers());

  app.get('/api/boards', async () => repo.listBoards());

  app.get('/api/boards/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const board = await repo.getBoardPayload(id);
    if (!board) throw notFound('Board');
    return board;
  });

  app.post('/api/cards', async (req, reply) => {
    const body = newCardBody.parse(req.body);
    const card = await repo.createCard(body);
    return reply.code(201).send(card);
  });

  app.patch('/api/cards/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const patch = cardPatchBody.parse(req.body);
    const card = await repo.updateCard(id, patch);
    if (!card) throw notFound('Card');
    return card;
  });

  app.delete('/api/cards/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    if (!(await repo.deleteCard(id))) throw notFound('Card');
    return reply.code(204).send();
  });

  app.get('/api/cards/:id/comments', async (req) => {
    const { id } = idParams.parse(req.params);
    const comments = await repo.listComments(id);
    if (!comments) throw notFound('Card');
    return comments;
  });

  app.post('/api/cards/:id/comments', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const body = newCommentBody.parse(req.body);
    const comment = await repo.createComment(id, body);
    return reply.code(201).send(comment);
  });
}
