import { boardPayloadSchema } from '@teamboard/db/schemas';
import type {
  AppConfig,
  BoardPayload,
  BoardSummary,
  Card,
  CardPatch,
  Comment,
  FeatureFlag,
  NewCardInput,
  NewCommentInput,
  User,
} from '@teamboard/db/types';

/** Error thrown for every failed API call (HTTP errors and network failures). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: {
        accept: 'application/json',
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new ApiError(
      res.status,
      body?.error ?? 'http_error',
      body?.message ?? `Request failed with status ${res.status}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getConfig: () => request<AppConfig>('/api/config'),
  setFlag: (key: string, enabled: boolean) =>
    request<FeatureFlag>(`/api/config/flags/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      json: { enabled },
    }),
  listBoards: () => request<BoardSummary[]>('/api/boards'),
  getBoard: async (id: number): Promise<BoardPayload> => {
    const data = await request<unknown>(`/api/boards/${id}`);
    const parsed = boardPayloadSchema.safeParse(data);
    if (!parsed.success) {
      throw new ApiError(
        502,
        'invalid_response',
        'The server sent a board in an unexpected shape.',
      );
    }
    return parsed.data;
  },
  listUsers: () => request<User[]>('/api/users'),
  createCard: (input: NewCardInput) => request<Card>('/api/cards', { method: 'POST', json: input }),
  updateCard: (id: number, patch: CardPatch) =>
    request<Card>(`/api/cards/${id}`, { method: 'PATCH', json: patch }),
  deleteCard: (id: number) => request<void>(`/api/cards/${id}`, { method: 'DELETE' }),
  listComments: (cardId: number) => request<Comment[]>(`/api/cards/${cardId}/comments`),
  createComment: (cardId: number, input: NewCommentInput) =>
    request<Comment>(`/api/cards/${cardId}/comments`, { method: 'POST', json: input }),
};
