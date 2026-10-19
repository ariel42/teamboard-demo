import { z } from 'zod';
import { PRIORITIES } from './types.ts';
import type { BoardPayload, User } from './types.ts';

export const prioritySchema = z.enum(PRIORITIES);

export const userSchema = z.strictObject({
  id: z.number().int().positive(),
  name: z.string().min(1),
  initials: z.string().min(1).max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
}) satisfies z.ZodType<User>;

export const boardPayloadCardSchema = z.strictObject({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string(),
  assignee: userSchema.nullable(),
  priority: prioritySchema,
  dueDate: z.iso.date().nullable(),
  labels: z.array(z.string().min(1)),
  position: z.number().int().min(0),
  commentCount: z.number().int().min(0),
});

export const boardPayloadColumnSchema = z.strictObject({
  id: z.number().int().positive(),
  name: z.string().min(1),
  position: z.number().int().min(0),
  cards: z.array(boardPayloadCardSchema),
});

/** Validates the board payload (GET /api/boards/:id and every mocks fixture). */
export const boardPayloadSchema = z.strictObject({
  board: z.strictObject({
    id: z.number().int().positive(),
    name: z.string().min(1),
    description: z.string(),
  }),
  users: z.array(userSchema),
  columns: z.array(boardPayloadColumnSchema),
}) satisfies z.ZodType<BoardPayload>;
