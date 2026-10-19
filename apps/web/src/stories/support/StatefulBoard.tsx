import { useState } from 'react';
import { Board, type BoardProps } from '../../components/Board/Board';
import { moveCardInBoard } from '../../lib/moveCard';
import type { BoardPayload, BoardPayloadCard } from '../../lib/types';

export interface StatefulBoardProps extends Partial<Omit<BoardProps, 'data'>> {
  data: BoardPayload;
}

/**
 * The presentational Board with just enough local state (moves, new cards) for stories and play
 * tests to interact with it. No network: the page stories cover the API round trip.
 */
export function StatefulBoard({
  data,
  onMoveCard,
  onAddCard,
  onOpenCard,
  ...rest
}: StatefulBoardProps) {
  const [board, setBoard] = useState(data);
  const [nextId, setNextId] = useState(100_000);
  return (
    <Board
      {...rest}
      data={board}
      onMoveCard={(cardId, columnId, position) => {
        setBoard((b) => moveCardInBoard(b, cardId, columnId, position));
        onMoveCard?.(cardId, columnId, position);
      }}
      onAddCard={(columnId, title) => {
        const card: BoardPayloadCard = {
          id: nextId,
          title,
          description: '',
          assignee: null,
          priority: 'medium',
          dueDate: null,
          labels: [],
          position: 0,
          commentCount: 0,
        };
        setNextId((n) => n + 1);
        setBoard((b) => ({
          ...b,
          columns: b.columns.map((c) =>
            c.id === columnId
              ? { ...c, cards: [...c.cards, { ...card, position: c.cards.length }] }
              : c,
          ),
        }));
        onAddCard?.(columnId, title);
      }}
      onOpenCard={(id) => onOpenCard?.(id)}
    />
  );
}
