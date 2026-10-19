/**
 * Shared Teamboard types. This file has no runtime dependencies so the web app
 * can `import type` from "@teamboard/db/types" without pulling in pg.
 */

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface User {
  id: number;
  name: string;
  initials: string;
  /** CSS color used for the avatar background, e.g. "#6366f1". */
  color: string;
}

export interface Board {
  id: number;
  name: string;
  description: string;
}

export interface Column {
  id: number;
  boardId: number;
  name: string;
  position: number;
}

export interface Card {
  id: number;
  columnId: number;
  title: string;
  description: string;
  assigneeId: number | null;
  priority: Priority;
  /** Calendar date, "YYYY-MM-DD". */
  dueDate: string | null;
  labels: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  cardId: number;
  authorId: number;
  author: User;
  body: string;
  createdAt: string;
}

export interface BoardSummary {
  id: number;
  name: string;
  description: string;
  cardCount: number;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
}

/** A card as it appears inside a board payload. */
export interface BoardPayloadCard {
  id: number;
  title: string;
  description: string;
  assignee: User | null;
  priority: Priority;
  dueDate: string | null;
  labels: string[];
  position: number;
  commentCount: number;
}

export interface BoardPayloadColumn {
  id: number;
  name: string;
  position: number;
  cards: BoardPayloadCard[];
}

/** The response of GET /api/boards/:id. Every `mocks.fixtures.data` has this shape. */
export interface BoardPayload {
  board: Board;
  users: User[];
  columns: BoardPayloadColumn[];
}

export interface AppConfig {
  flags: Record<string, boolean>;
  settings: Record<string, unknown>;
  env: { kind: string; user: string };
}

export interface NewCardInput {
  columnId: number;
  title: string;
  description?: string;
  priority?: Priority;
  assigneeId?: number | null;
  dueDate?: string | null;
  labels?: string[];
  /** Zero-based index inside the column; defaults to the end. */
  position?: number;
}

export type CardPatch = Partial<Omit<NewCardInput, 'columnId'>> & { columnId?: number };

export interface NewCommentInput {
  authorId: number;
  body: string;
}
