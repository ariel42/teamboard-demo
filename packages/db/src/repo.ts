import type { PoolClient } from 'pg';
import type { Pool } from './pool.ts';
import { resolveSchemas } from './schema-names.ts';
import type { SchemaNames } from './schema-names.ts';
import type {
  BoardPayload,
  BoardPayloadCard,
  BoardSummary,
  Card,
  CardPatch,
  Comment,
  FeatureFlag,
  NewCardInput,
  NewCommentInput,
  Priority,
  User,
} from './types.ts';

export type DomainErrorCode = 'not_found' | 'invalid_reference';

/** Raised for expected, user-facing failures (the API maps these to 404 / 422). */
export class DomainError extends Error {
  code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

interface UserRow {
  id: number;
  name: string;
  initials: string;
  color: string;
}

interface CardRow {
  id: number;
  column_id: number;
  title: string;
  description: string;
  assignee_id: number | null;
  priority: Priority;
  due_date: string | null;
  labels: string[];
  position: number;
  created_at: Date;
  updated_at: Date;
}

interface CommentRow {
  id: number;
  card_id: number;
  author_id: number;
  body: string;
  created_at: Date;
  author_name: string;
  author_initials: string;
  author_color: string;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  initials: r.initials,
  color: r.color,
});

const toCard = (r: CardRow): Card => ({
  id: r.id,
  columnId: r.column_id,
  title: r.title,
  description: r.description,
  assigneeId: r.assignee_id,
  priority: r.priority,
  dueDate: r.due_date,
  labels: r.labels,
  position: r.position,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  cardId: r.card_id,
  authorId: r.author_id,
  author: {
    id: r.author_id,
    name: r.author_name,
    initials: r.author_initials,
    color: r.author_color,
  },
  body: r.body,
  createdAt: r.created_at.toISOString(),
});

/** Translates foreign-key violations into DomainErrors; anything else is rethrown as is. */
function mapPgError(err: unknown): unknown {
  const e = err as { code?: string; constraint?: string } | null;
  if (e?.code === '23503') {
    switch (e.constraint) {
      case 'cards_column_id_fkey':
        return new DomainError('invalid_reference', 'column does not exist');
      case 'cards_assignee_id_fkey':
        return new DomainError('invalid_reference', 'assignee does not exist');
      case 'comments_author_id_fkey':
        return new DomainError('invalid_reference', 'author does not exist');
      case 'comments_card_id_fkey':
        return new DomainError('not_found', 'card not found');
    }
  }
  return err;
}

/**
 * Hand-written typed queries for Teamboard. All card mutations that touch positions run in one
 * transaction under a single advisory lock, so positions in a column stay dense (0..n-1) and
 * concurrent moves cannot interleave.
 */
export function createRepo(pool: Pool, schemas: SchemaNames = resolveSchemas()) {
  const { app, config } = schemas;

  const CARD_COLUMNS = `id, column_id, title, description, assignee_id, priority,
    to_char(due_date, 'YYYY-MM-DD') as due_date, labels, position, created_at, updated_at`;

  async function inCardTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [
        `teamboard:cards:${schemas.raw.app}`,
      ]);
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw mapPgError(err);
    } finally {
      client.release();
    }
  }

  async function columnExists(client: PoolClient, columnId: number): Promise<boolean> {
    const { rowCount } = await client.query(`select 1 from ${app}.columns where id = $1`, [
      columnId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  async function countInColumn(
    client: PoolClient,
    columnId: number,
    excludeCardId?: number,
  ): Promise<number> {
    const { rows } = await client.query<{ n: number }>(
      `select count(*)::int as n from ${app}.cards where column_id = $1 and id <> $2`,
      [columnId, excludeCardId ?? 0],
    );
    return rows[0]?.n ?? 0;
  }

  return {
    schemas,

    async ping(): Promise<boolean> {
      const { rows } = await pool.query<{ ok: number }>('select 1 as ok');
      return rows[0]?.ok === 1;
    },

    // ---- config -----------------------------------------------------------------------------

    async getFlags(): Promise<Record<string, boolean>> {
      const { rows } = await pool.query<{ key: string; enabled: boolean }>(
        `select key, enabled from ${config}.feature_flags order by key`,
      );
      return Object.fromEntries(rows.map((r) => [r.key, r.enabled]));
    },

    async getSettings(): Promise<Record<string, unknown>> {
      const { rows } = await pool.query<{ key: string; value: unknown }>(
        `select key, value from ${config}.settings order by key`,
      );
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },

    async setFlag(key: string, enabled: boolean): Promise<FeatureFlag | null> {
      const { rows } = await pool.query<FeatureFlag>(
        `update ${config}.feature_flags set enabled = $2 where key = $1
         returning key, enabled, description`,
        [key, enabled],
      );
      return rows[0] ?? null;
    },

    // ---- users ------------------------------------------------------------------------------

    async listUsers(): Promise<User[]> {
      const { rows } = await pool.query<UserRow>(
        `select id, name, initials, color from ${app}.users order by id`,
      );
      return rows.map(toUser);
    },

    // ---- boards -----------------------------------------------------------------------------

    async listBoards(): Promise<BoardSummary[]> {
      const { rows } = await pool.query<BoardSummary>(
        `select b.id, b.name, b.description,
                (select count(*)::int from ${app}.cards c
                   join ${app}.columns col on col.id = c.column_id
                  where col.board_id = b.id) as "cardCount"
           from ${app}.boards b
          order by b.id`,
      );
      return rows;
    },

    async getBoardPayload(boardId: number): Promise<BoardPayload | null> {
      const boardRes = await pool.query<{ id: number; name: string; description: string }>(
        `select id, name, description from ${app}.boards where id = $1`,
        [boardId],
      );
      const board = boardRes.rows[0];
      if (!board) return null;

      const [usersRes, columnsRes, cardsRes] = await Promise.all([
        pool.query<UserRow>(`select id, name, initials, color from ${app}.users order by id`),
        pool.query<{ id: number; name: string; position: number }>(
          `select id, name, position from ${app}.columns
            where board_id = $1 order by position, id`,
          [boardId],
        ),
        pool.query<CardRow & { comment_count: number }>(
          `select c.id, c.column_id, c.title, c.description, c.assignee_id, c.priority,
                  to_char(c.due_date, 'YYYY-MM-DD') as due_date, c.labels, c.position,
                  c.created_at, c.updated_at,
                  (select count(*)::int from ${app}.comments m where m.card_id = c.id) as comment_count
             from ${app}.cards c
             join ${app}.columns col on col.id = c.column_id
            where col.board_id = $1
            order by c.position, c.id`,
          [boardId],
        ),
      ]);

      const users = usersRes.rows.map(toUser);
      const usersById = new Map(users.map((u) => [u.id, u]));
      const cardsByColumn = new Map<number, BoardPayloadCard[]>();
      for (const r of cardsRes.rows) {
        const list = cardsByColumn.get(r.column_id) ?? [];
        list.push({
          id: r.id,
          title: r.title,
          description: r.description,
          assignee: r.assignee_id === null ? null : (usersById.get(r.assignee_id) ?? null),
          priority: r.priority,
          dueDate: r.due_date,
          labels: r.labels,
          position: r.position,
          commentCount: r.comment_count,
        });
        cardsByColumn.set(r.column_id, list);
      }

      return {
        board,
        users,
        columns: columnsRes.rows.map((c) => ({
          id: c.id,
          name: c.name,
          position: c.position,
          cards: cardsByColumn.get(c.id) ?? [],
        })),
      };
    },

    // ---- cards ------------------------------------------------------------------------------

    async getCard(id: number): Promise<Card | null> {
      const { rows } = await pool.query<CardRow>(
        `select ${CARD_COLUMNS} from ${app}.cards where id = $1`,
        [id],
      );
      return rows[0] ? toCard(rows[0]) : null;
    },

    async createCard(input: NewCardInput): Promise<Card> {
      return inCardTransaction(async (client) => {
        if (!(await columnExists(client, input.columnId))) {
          throw new DomainError('invalid_reference', 'column does not exist');
        }
        const count = await countInColumn(client, input.columnId);
        const position = Math.min(input.position ?? count, count);
        if (position < count) {
          await client.query(
            `update ${app}.cards set position = position + 1
              where column_id = $1 and position >= $2`,
            [input.columnId, position],
          );
        }
        const { rows } = await client.query<CardRow>(
          `insert into ${app}.cards
             (column_id, title, description, assignee_id, priority, due_date, labels, position)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning ${CARD_COLUMNS}`,
          [
            input.columnId,
            input.title,
            input.description ?? '',
            input.assigneeId ?? null,
            input.priority ?? 'medium',
            input.dueDate ?? null,
            input.labels ?? [],
            position,
          ],
        );
        return toCard(rows[0]!);
      });
    },

    /** Applies a partial update, including moves (columnId and/or position). Null if no such card. */
    async updateCard(id: number, patch: CardPatch): Promise<Card | null> {
      return inCardTransaction(async (client) => {
        const curRes = await client.query<{ column_id: number; position: number }>(
          `select column_id, position from ${app}.cards where id = $1`,
          [id],
        );
        const cur = curRes.rows[0];
        if (!cur) return null;

        const targetColumn = patch.columnId ?? cur.column_id;
        if (patch.columnId !== undefined && patch.columnId !== cur.column_id) {
          if (!(await columnExists(client, patch.columnId))) {
            throw new DomainError('invalid_reference', 'column does not exist');
          }
        }

        let newPosition = cur.position;
        if (patch.columnId !== undefined || patch.position !== undefined) {
          const others = await countInColumn(client, targetColumn, id);
          newPosition =
            patch.position !== undefined
              ? Math.min(patch.position, others)
              : targetColumn === cur.column_id
                ? cur.position
                : others;
        }

        const sets: string[] = [];
        const values: unknown[] = [id];
        const set = (column: string, value: unknown) => {
          values.push(value);
          sets.push(`${column} = $${values.length}`);
        };

        if (targetColumn !== cur.column_id || newPosition !== cur.position) {
          await client.query(
            `update ${app}.cards set position = position - 1
              where column_id = $1 and position > $2 and id <> $3`,
            [cur.column_id, cur.position, id],
          );
          await client.query(
            `update ${app}.cards set position = position + 1
              where column_id = $1 and position >= $2 and id <> $3`,
            [targetColumn, newPosition, id],
          );
          set('column_id', targetColumn);
          set('position', newPosition);
        }
        if (patch.title !== undefined) set('title', patch.title);
        if (patch.description !== undefined) set('description', patch.description);
        if (patch.priority !== undefined) set('priority', patch.priority);
        if (patch.assigneeId !== undefined) set('assignee_id', patch.assigneeId);
        if (patch.dueDate !== undefined) set('due_date', patch.dueDate);
        if (patch.labels !== undefined) set('labels', patch.labels);

        if (sets.length > 0) {
          await client.query(
            `update ${app}.cards set ${sets.join(', ')}, updated_at = now() where id = $1`,
            values,
          );
        }
        const { rows } = await client.query<CardRow>(
          `select ${CARD_COLUMNS} from ${app}.cards where id = $1`,
          [id],
        );
        return toCard(rows[0]!);
      });
    },

    async deleteCard(id: number): Promise<boolean> {
      return inCardTransaction(async (client) => {
        const { rows } = await client.query<{ column_id: number; position: number }>(
          `delete from ${app}.cards where id = $1 returning column_id, position`,
          [id],
        );
        const gone = rows[0];
        if (!gone) return false;
        await client.query(
          `update ${app}.cards set position = position - 1
            where column_id = $1 and position > $2`,
          [gone.column_id, gone.position],
        );
        return true;
      });
    },

    // ---- comments ---------------------------------------------------------------------------

    /** Null if the card does not exist. */
    async listComments(cardId: number): Promise<Comment[] | null> {
      const exists = await pool.query(`select 1 from ${app}.cards where id = $1`, [cardId]);
      if (exists.rowCount === 0) return null;
      const { rows } = await pool.query<CommentRow>(
        `select m.id, m.card_id, m.author_id, m.body, m.created_at,
                u.name as author_name, u.initials as author_initials, u.color as author_color
           from ${app}.comments m
           join ${app}.users u on u.id = m.author_id
          where m.card_id = $1
          order by m.created_at, m.id`,
        [cardId],
      );
      return rows.map(toComment);
    },

    async createComment(cardId: number, input: NewCommentInput): Promise<Comment> {
      try {
        const { rows } = await pool.query<CommentRow>(
          `with m as (
             insert into ${app}.comments (card_id, author_id, body)
             values ($1, $2, $3)
             returning id, card_id, author_id, body, created_at
           )
           select m.id, m.card_id, m.author_id, m.body, m.created_at,
                  u.name as author_name, u.initials as author_initials, u.color as author_color
             from m join ${app}.users u on u.id = m.author_id`,
          [cardId, input.authorId, input.body],
        );
        return toComment(rows[0]!);
      } catch (err) {
        throw mapPgError(err);
      }
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
