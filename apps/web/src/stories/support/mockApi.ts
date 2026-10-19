import { delay, http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';
import { moveCardInBoard } from '../../lib/moveCard';
import type {
  AppConfig,
  BoardPayload,
  BoardPayloadCard,
  CardPatch,
  Comment,
  NewCardInput,
  NewCommentInput,
  User,
} from '../../lib/types';

export const DEFAULT_FLAGS: Record<string, boolean> = {
  card_comments: true,
  due_dates: true,
  wip_limits: false,
  compact_cards: false,
};

export interface MockApiOptions {
  /** Board served by GET /api/boards/:id (usually from loadFixture). */
  fixture: BoardPayload;
  flags?: Partial<Record<string, boolean>>;
  /** settings.wip_limit */
  wipLimit?: number;
  env?: AppConfig['env'];
  /** Artificial latency in ms for every response. */
  latency?: number;
  /** 'pending' never answers the board request (loading state); 'error' answers 500 until `recover`. */
  board?: 'ok' | 'pending' | 'error';
  /** For board: 'error', succeed from the Nth board request on (retry story). */
  recoverAfter?: number;
}

const SAMPLE_COMMENTS = [
  'Looks good to me, shipping it after the review.',
  'Can we split this into two smaller cards?',
  'Blocked on the API change, pinging the owner.',
  'Done on my side. Please double check the edge cases.',
  'Added a note to the docs.',
];

function seedComments(card: BoardPayloadCard, users: User[], startId: number): Comment[] {
  if (users.length === 0) return [];
  return Array.from({ length: card.commentCount }, (_, i) => {
    const author = users[(card.id + i) % users.length] as User;
    return {
      id: startId + i,
      cardId: card.id,
      authorId: author.id,
      author,
      body: SAMPLE_COMMENTS[(card.id + i) % SAMPLE_COMMENTS.length] as string,
      createdAt: new Date(Date.UTC(2026, 9, 1 + i, 9, 30)).toISOString(),
    };
  });
}

/** Stateful in-memory stand-in for the Teamboard API. One instance per story run. */
export function createMockApi(options: MockApiOptions): HttpHandler[] {
  let board: BoardPayload = structuredClone(options.fixture);
  const flags: Record<string, boolean> = { ...DEFAULT_FLAGS, ...options.flags } as Record<
    string,
    boolean
  >;
  const env = options.env ?? { kind: 'mise', user: board.users[0]?.name ?? 'Maya' };
  const comments = new Map<number, Comment[]>();
  let nextId = 10_000;
  let boardRequests = 0;

  board.columns.forEach((column) =>
    column.cards.forEach((card) => {
      comments.set(card.id, seedComments(card, board.users, nextId));
      nextId += card.commentCount;
    }),
  );

  const wait = () => (options.latency ? delay(options.latency) : Promise.resolve());
  const boardId = board.board.id;
  const cardCount = () => board.columns.reduce((n, c) => n + c.cards.length, 0);
  const find = (id: number) => {
    for (const column of board.columns) {
      const card = column.cards.find((c) => c.id === id);
      if (card) return { card, column };
    }
    return null;
  };
  const toCard = (card: BoardPayloadCard, columnId: number) => ({
    id: card.id,
    columnId,
    title: card.title,
    description: card.description,
    assigneeId: card.assignee?.id ?? null,
    priority: card.priority,
    dueDate: card.dueDate,
    labels: card.labels,
    position: card.position,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  });
  const notFound = () =>
    HttpResponse.json({ error: 'not_found', message: 'Not found' }, { status: 404 });

  return [
    http.get('/api/config', async () => {
      await wait();
      return HttpResponse.json({
        flags,
        settings: { wip_limit: options.wipLimit ?? 5 },
        env,
      } satisfies AppConfig);
    }),
    http.patch('/api/config/flags/:key', async ({ params, request }) => {
      await wait();
      const key = String(params.key);
      const { enabled } = (await request.json()) as { enabled: boolean };
      flags[key] = enabled;
      return HttpResponse.json({ key, enabled, description: '' });
    }),
    http.get('/api/boards', async () => {
      await wait();
      return HttpResponse.json([
        {
          id: boardId,
          name: board.board.name,
          description: board.board.description,
          cardCount: cardCount(),
        },
      ]);
    }),
    http.get('/api/users', () => HttpResponse.json(board.users)),
    http.get('/api/boards/:id', async ({ params }) => {
      boardRequests += 1;
      if (options.board === 'pending') return new Promise<never>(() => {});
      await wait();
      if (options.board === 'error' && boardRequests <= (options.recoverAfter ?? Infinity)) {
        return HttpResponse.json(
          { error: 'internal', message: 'The database is not responding.' },
          { status: 500 },
        );
      }
      if (Number(params.id) !== boardId) return notFound();
      return HttpResponse.json(board);
    }),
    http.post('/api/cards', async ({ request }) => {
      await wait();
      const input = (await request.json()) as NewCardInput;
      const column = board.columns.find((c) => c.id === input.columnId);
      if (!column) return notFound();
      const card: BoardPayloadCard = {
        id: nextId++,
        title: input.title,
        description: input.description ?? '',
        assignee: board.users.find((u) => u.id === input.assigneeId) ?? null,
        priority: input.priority ?? 'medium',
        dueDate: input.dueDate ?? null,
        labels: input.labels ?? [],
        position: column.cards.length,
        commentCount: 0,
      };
      column.cards = [...column.cards, card];
      comments.set(card.id, []);
      return HttpResponse.json(toCard(card, column.id), { status: 201 });
    }),
    http.patch('/api/cards/:id', async ({ params, request }) => {
      await wait();
      const found = find(Number(params.id));
      if (!found) return notFound();
      const patch = (await request.json()) as CardPatch;
      const { columnId, position, assigneeId, ...rest } = patch;
      let target = found;
      if (columnId !== undefined || position !== undefined) {
        board = moveCardInBoard(
          board,
          found.card.id,
          columnId ?? found.column.id,
          position ?? found.card.position,
        );
        target = find(found.card.id) ?? found;
      }
      Object.assign(target.card, rest);
      if (assigneeId !== undefined) {
        target.card.assignee = board.users.find((u) => u.id === assigneeId) ?? null;
      }
      return HttpResponse.json(toCard(target.card, target.column.id));
    }),
    http.delete('/api/cards/:id', async ({ params }) => {
      await wait();
      const found = find(Number(params.id));
      if (!found) return notFound();
      found.column.cards = found.column.cards
        .filter((c) => c.id !== found.card.id)
        .map((c, i) => ({ ...c, position: i }));
      comments.delete(found.card.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/cards/:id/comments', async ({ params }) => {
      await wait();
      return HttpResponse.json(comments.get(Number(params.id)) ?? []);
    }),
    http.post('/api/cards/:id/comments', async ({ params, request }) => {
      await wait();
      const cardId = Number(params.id);
      const found = find(cardId);
      if (!found) return notFound();
      const input = (await request.json()) as NewCommentInput;
      const author = board.users.find((u) => u.id === input.authorId);
      if (!author) return HttpResponse.json({ error: 'bad_request' }, { status: 400 });
      const comment: Comment = {
        id: nextId++,
        cardId,
        authorId: author.id,
        author,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      comments.set(cardId, [...(comments.get(cardId) ?? []), comment]);
      found.card.commentCount += 1;
      return HttpResponse.json(comment, { status: 201 });
    }),
  ];
}
