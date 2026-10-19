import type { KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cardDndId } from '../../lib/dnd';
import type { BoardPayloadCard } from '../../lib/types';
import { TaskCard } from '../TaskCard/TaskCard';

export interface BoardCardProps {
  card: BoardPayloadCard;
  showDueDate: boolean;
  showComments: boolean;
  compact: boolean;
  selected: boolean;
  onOpen: (cardId: number) => void;
}

/** A TaskCard wired into dnd-kit: pointer drag, Space to lift with the keyboard, Enter/click to open. */
export function BoardCard({
  card,
  showDueDate,
  showComments,
  compact,
  selected,
  onOpen,
}: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDndId(card.id),
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(event);
    if (event.key === 'Enter' && !isDragging && event.target === event.currentTarget) {
      event.preventDefault();
      onOpen(card.id);
    }
  };

  return (
    <TaskCard
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      title={card.title}
      labels={card.labels}
      priority={card.priority}
      assignee={card.assignee}
      dueDate={card.dueDate}
      commentCount={card.commentCount}
      showDueDate={showDueDate}
      showComments={showComments}
      compact={compact}
      selected={selected}
      dragging={isDragging}
      data-testid="task-card"
      data-card-id={card.id}
      {...attributes}
      aria-pressed={undefined}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => onOpen(card.id)}
    />
  );
}
