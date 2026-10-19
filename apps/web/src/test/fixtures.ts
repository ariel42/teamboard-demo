import type { BoardPayload, BoardPayloadCard } from '../lib/types';

export const makeCard = (id: number, position: number, title = `Card ${id}`): BoardPayloadCard => ({
  id,
  title,
  description: '',
  assignee: null,
  priority: 'medium',
  dueDate: null,
  labels: [],
  position,
  commentCount: 0,
});

/** Two columns: A holds cards 1,2,3; B holds 4,5; C is empty. */
export const makeBoard = (): BoardPayload => ({
  board: { id: 1, name: 'Board', description: '' },
  users: [],
  columns: [
    { id: 10, name: 'A', position: 0, cards: [makeCard(1, 0), makeCard(2, 1), makeCard(3, 2)] },
    { id: 20, name: 'B', position: 1, cards: [makeCard(4, 0), makeCard(5, 1)] },
    { id: 30, name: 'C', position: 2, cards: [] },
  ],
});

export const idsOf = (data: BoardPayload, columnId: number) =>
  data.columns.find((c) => c.id === columnId)?.cards.map((c) => c.id);
