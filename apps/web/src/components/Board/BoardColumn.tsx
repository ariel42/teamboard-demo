import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cardDndId, columnDndId } from '../../lib/dnd';
import type { Flags } from '../../lib/flags';
import type { BoardPayloadColumn } from '../../lib/types';
import { Column } from '../Column/Column';
import { BoardCard } from './BoardCard';

export interface BoardColumnProps {
  column: BoardPayloadColumn;
  flags: Flags;
  wipLimit: number | null;
  selectedCardId: number | null;
  onAddCard: (columnId: number, title: string) => void;
  onOpenCard: (cardId: number) => void;
}

export function BoardColumn({
  column,
  flags,
  wipLimit,
  selectedCardId,
  onAddCard,
  onOpenCard,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDndId(column.id) });
  return (
    <SortableContext
      items={column.cards.map((card) => cardDndId(card.id))}
      strategy={verticalListSortingStrategy}
    >
      <Column
        name={column.name}
        count={column.cards.length}
        wipLimit={wipLimit}
        showWip={flags.wipLimits}
        highlighted={isOver}
        listRef={setNodeRef}
        onAddCard={(title) => onAddCard(column.id, title)}
      >
        {column.cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            showDueDate={flags.dueDates}
            showComments={flags.cardComments}
            compact={flags.compactCards}
            selected={card.id === selectedCardId}
            onOpen={onOpenCard}
          />
        ))}
      </Column>
    </SortableContext>
  );
}
