import type { BoardPayload, BoardPayloadColumn } from './types';

export interface CardLocation {
  columnId: number;
  index: number;
}

/** Where a card currently is, or null if the board does not contain it. */
export function locateCard(data: BoardPayload, cardId: number): CardLocation | null {
  for (const column of data.columns) {
    const index = column.cards.findIndex((c) => c.id === cardId);
    if (index !== -1) return { columnId: column.id, index };
  }
  return null;
}

const renumber = (column: BoardPayloadColumn): BoardPayloadColumn => ({
  ...column,
  cards: column.cards.map((c, i) => (c.position === i ? c : { ...c, position: i })),
});

/**
 * Pure reducer for moving a card: returns a new payload with `cardId` at `toIndex` of `toColumnId`.
 * `toIndex` is the index in the destination column after the card has been removed from its old
 * place (so it matches the `position` the API expects), and is clamped to the column length.
 * Positions stay dense (0..n-1). Returns the same object if nothing changes or ids are unknown.
 */
export function moveCardInBoard(
  data: BoardPayload,
  cardId: number,
  toColumnId: number,
  toIndex: number,
): BoardPayload {
  const from = locateCard(data, cardId);
  const target = data.columns.find((c) => c.id === toColumnId);
  if (!from || !target) return data;

  const moving = data.columns.find((c) => c.id === from.columnId)?.cards[from.index];
  if (!moving) return data;

  const withoutMoving = target.cards.filter((c) => c.id !== cardId);
  const index = Math.max(0, Math.min(Math.trunc(toIndex), withoutMoving.length));
  if (from.columnId === toColumnId && from.index === index) return data;

  return {
    ...data,
    columns: data.columns.map((column) => {
      if (column.id === from.columnId && column.id === toColumnId) {
        const cards = [...withoutMoving];
        cards.splice(index, 0, moving);
        return renumber({ ...column, cards });
      }
      if (column.id === from.columnId) {
        return renumber({ ...column, cards: column.cards.filter((c) => c.id !== cardId) });
      }
      if (column.id === toColumnId) {
        const cards = [...column.cards];
        cards.splice(index, 0, moving);
        return renumber({ ...column, cards });
      }
      return column;
    }),
  };
}
