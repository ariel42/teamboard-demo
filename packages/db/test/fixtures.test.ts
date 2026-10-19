import { describe, expect, it } from 'vitest';
import { PRIORITIES, boardPayloadSchema, buildFixtures } from '../src/index.ts';
import type { BoardPayload } from '../src/index.ts';

const fixtures = buildFixtures();
const byName = (name: string): BoardPayload => {
  const f = fixtures.find((x) => x.name === name);
  if (!f) throw new Error(`missing fixture ${name}`);
  return f.data;
};
const allCards = (p: BoardPayload) => p.columns.flatMap((c) => c.cards);

describe('fixtures', () => {
  it('provides the six documented fixtures', () => {
    expect(fixtures.map((f) => f.name)).toEqual([
      'typical',
      'empty',
      'overloaded',
      'long-text',
      'rtl-hebrew',
      'all-priorities',
    ]);
  });

  it('is deterministic', () => {
    expect(buildFixtures()).toEqual(buildFixtures());
  });

  describe.each(fixtures.map((f) => [f.name, f.data] as const))('%s', (_name, data) => {
    it('matches the board payload schema', () => {
      expect(boardPayloadSchema.safeParse(data).success).toBe(true);
    });

    it('has unique ids, dense positions and known assignees', () => {
      const cards = allCards(data);
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
      expect(new Set(data.columns.map((c) => c.id)).size).toBe(data.columns.length);
      data.columns.forEach((col, i) => {
        expect(col.position).toBe(i);
        expect(col.cards.map((c) => c.position)).toEqual(col.cards.map((_, j) => j));
      });
      const userIds = new Set(data.users.map((u) => u.id));
      for (const c of cards) if (c.assignee) expect(userIds.has(c.assignee.id)).toBe(true);
    });
  });

  it('typical: 4 columns, about a dozen cards, 5 users, comments', () => {
    const p = byName('typical');
    expect(p.board.name).toBe('Sprint 24');
    expect(p.columns).toHaveLength(4);
    expect(p.users).toHaveLength(5);
    expect(allCards(p).length).toBeGreaterThanOrEqual(12);
    expect(allCards(p).some((c) => c.commentCount > 0)).toBe(true);
  });

  it('empty: columns without cards', () => {
    const p = byName('empty');
    expect(p.columns.length).toBeGreaterThanOrEqual(3);
    expect(allCards(p)).toHaveLength(0);
  });

  it('overloaded: 100+ cards with one column far beyond the WIP limit', () => {
    const p = byName('overloaded');
    expect(allCards(p).length).toBeGreaterThan(100);
    expect(Math.max(...p.columns.map((c) => c.cards.length))).toBeGreaterThan(5 * 5);
  });

  it('long-text: very long strings and emoji', () => {
    const cards = allCards(byName('long-text'));
    expect(Math.max(...cards.map((c) => c.title.length))).toBeGreaterThan(250);
    expect(Math.max(...cards.map((c) => c.description.length))).toBeGreaterThan(2000);
    expect(cards.some((c) => /\p{Extended_Pictographic}/u.test(c.title))).toBe(true);
  });

  it('rtl-hebrew: Hebrew titles and users', () => {
    const p = byName('rtl-hebrew');
    const hebrew = /[֐-׿]/;
    expect(allCards(p).every((c) => hebrew.test(c.title))).toBe(true);
    expect(p.users.every((u) => hebrew.test(u.name))).toBe(true);
  });

  it('all-priorities: every priority with and without due date and labels', () => {
    const cards = allCards(byName('all-priorities'));
    for (const priority of PRIORITIES) {
      const ofPriority = cards.filter((c) => c.priority === priority);
      expect(ofPriority.some((c) => c.dueDate !== null)).toBe(true);
      expect(ofPriority.some((c) => c.dueDate === null)).toBe(true);
      expect(ofPriority.some((c) => c.labels.length > 0)).toBe(true);
      expect(ofPriority.some((c) => c.labels.length === 0)).toBe(true);
    }
  });
});

describe('boardPayloadSchema', () => {
  it('rejects malformed payloads', () => {
    const good = byName('typical');
    const bad = structuredClone(good);
    bad.columns[0]!.cards[0]!.priority = 'critical' as never;
    expect(boardPayloadSchema.safeParse(bad).success).toBe(false);

    const extra = { ...good, surprise: true };
    expect(boardPayloadSchema.safeParse(extra).success).toBe(false);

    const badDate = structuredClone(good);
    badDate.columns[0]!.cards[0]!.dueDate = '21/10/2026';
    expect(boardPayloadSchema.safeParse(badDate).success).toBe(false);
  });
});
