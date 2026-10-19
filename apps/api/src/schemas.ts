import { z } from 'zod';
import { PRIORITIES } from '@teamboard/db';

const INT4_MAX = 2_147_483_647;

/** Path parameter: a positive integer that fits in a Postgres int4. */
const idString = z
  .string()
  .regex(/^[0-9]{1,10}$/, 'must be a positive integer')
  .transform(Number)
  .refine((n) => n >= 1 && n <= INT4_MAX, 'must be a positive integer');

export const idParams = z.strictObject({ id: idString });
export const flagParams = z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/) });

const refId = z.number().int().min(1).max(INT4_MAX);
const title = z.string().trim().min(1).max(500);
const description = z.string().max(20_000);
const priority = z.enum(PRIORITIES);
const dueDate = z.iso.date().nullable();
const labels = z.array(z.string().trim().min(1).max(50)).max(20);
const position = z.number().int().min(0).max(INT4_MAX);

export const flagBody = z.strictObject({ enabled: z.boolean() });

export const newCardBody = z.strictObject({
  columnId: refId,
  title,
  description: description.optional(),
  priority: priority.optional(),
  assigneeId: refId.nullable().optional(),
  dueDate: dueDate.optional(),
  labels: labels.optional(),
  position: position.optional(),
});

export const cardPatchBody = z
  .strictObject({
    columnId: refId,
    title,
    description,
    priority,
    assigneeId: refId.nullable(),
    dueDate,
    labels,
    position,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'at least one field is required');

export const newCommentBody = z.strictObject({
  authorId: refId,
  body: z.string().trim().min(1).max(10_000),
});
