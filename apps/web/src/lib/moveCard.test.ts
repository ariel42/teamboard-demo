import { describe, expect, it } from 'vitest';
import { idsOf, makeBoard } from '../test/fixtures';
import { locateCard, moveCardInBoard } from './moveCard';

describe('locateCard', () => {
  it('finds the column and index of a card', () => {
    expect(locateCard(makeBoard(), 5)).toEqual({ columnId: 20, index: 1 });
  });
  it('returns null for an unknown card', () => {
    expect(locateCard(makeBoard(), 99)).toBeNull();
  });
});

describe('moveCardInBoard', () => {
  it('reorders within a column using the index after removal', () => {
    const next = moveCardInBoard(makeBoard(), 1, 10, 2);
    expect(idsOf(next, 10)).toEqual([2, 3, 1]);
    expect(next.columns[0]!.cards.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it('moves up within a column', () => {
    expect(idsOf(moveCardInBoard(makeBoard(), 3, 10, 0), 10)).toEqual([3, 1, 2]);
  });

  it('moves across columns and renumbers both', () => {
    const next = moveCardInBoard(makeBoard(), 2, 20, 1);
    expect(idsOf(next, 10)).toEqual([1, 3]);
    expect(idsOf(next, 20)).toEqual([4, 2, 5]);
    expect(next.columns[0]!.cards.map((c) => c.position)).toEqual([0, 1]);
    expect(next.columns[1]!.cards.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it('moves into an empty column', () => {
    const next = moveCardInBoard(makeBoard(), 4, 30, 0);
    expect(idsOf(next, 30)).toEqual([4]);
    expect(idsOf(next, 20)).toEqual([5]);
  });

  it('clamps the index to the column length and to zero', () => {
    expect(idsOf(moveCardInBoard(makeBoard(), 1, 20, 99), 20)).toEqual([4, 5, 1]);
    expect(idsOf(moveCardInBoard(makeBoard(), 5, 10, -4), 10)).toEqual([5, 1, 2, 3]);
  });

  it('does not mutate the input and shares untouched columns', () => {
    const before = makeBoard();
    const snapshot = structuredClone(before);
    const next = moveCardInBoard(before, 2, 20, 0);
    expect(before).toEqual(snapshot);
    expect(next.columns[2]).toBe(before.columns[2]);
  });

  it('returns the same object for no-ops and unknown ids', () => {
    const board = makeBoard();
    expect(moveCardInBoard(board, 2, 10, 1)).toBe(board);
    expect(moveCardInBoard(board, 99, 10, 0)).toBe(board);
    expect(moveCardInBoard(board, 1, 99, 0)).toBe(board);
  });
});
