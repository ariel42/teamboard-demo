import type { BoardPayload, BoardPayloadCard, Priority, User } from '../types.ts';

/** Source description of a board; turned into a board payload (fixtures) or DB rows (starter board). */
export interface SeedUser {
  name: string;
  initials: string;
  color: string;
}

export interface SeedComment {
  /** User name, must exist in the board's users. */
  author: string;
  body: string;
  /** ISO timestamp. */
  at: string;
}

export interface SeedCard {
  title: string;
  description?: string;
  /** User name, or null/undefined for unassigned. */
  assignee?: string | null;
  priority?: Priority;
  /** "YYYY-MM-DD" */
  due?: string | null;
  labels?: string[];
  comments?: SeedComment[];
  /** Used when `comments` is not given (fixtures that only need a number). */
  commentCount?: number;
}

export interface SeedColumn {
  name: string;
  cards: SeedCard[];
}

export interface SeedBoard {
  name: string;
  description: string;
  users: SeedUser[];
  columns: SeedColumn[];
}

/** Builds the exact GET /api/boards/:id payload. Ids are assigned sequentially from 1. */
export function toPayload(seed: SeedBoard, boardId = 1): BoardPayload {
  const users: User[] = seed.users.map((u, i) => ({ id: i + 1, ...u }));
  const byName = new Map(users.map((u) => [u.name, u]));
  let cardId = 0;
  return {
    board: { id: boardId, name: seed.name, description: seed.description },
    users,
    columns: seed.columns.map((col, ci) => ({
      id: ci + 1,
      name: col.name,
      position: ci,
      cards: col.cards.map((card, pi): BoardPayloadCard => {
        let assignee: User | null = null;
        if (card.assignee) {
          assignee = byName.get(card.assignee) ?? null;
          if (!assignee) throw new Error(`Seed card "${card.title}": unknown assignee`);
        }
        return {
          id: ++cardId,
          title: card.title,
          description: card.description ?? '',
          assignee,
          priority: card.priority ?? 'medium',
          dueDate: card.due ?? null,
          labels: card.labels ?? [],
          position: pi,
          commentCount: card.comments?.length ?? card.commentCount ?? 0,
        };
      }),
    })),
  };
}
