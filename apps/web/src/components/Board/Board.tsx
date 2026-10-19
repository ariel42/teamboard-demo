import { useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { parseDndId } from '../../lib/dnd';
import { DEFAULT_FLAGS, type Flags } from '../../lib/flags';
import { locateCard, moveCardInBoard } from '../../lib/moveCard';
import type { BoardPayload } from '../../lib/types';
import { TaskCard } from '../TaskCard/TaskCard';
import { BoardColumn } from './BoardColumn';
import './Board.css';

export interface BoardProps {
  data: BoardPayload;
  flags?: Flags;
  /** `settings.wip_limit`; shown only when the `wip_limits` flag is on. */
  wipLimit?: number | null;
  selectedCardId?: number | null;
  /** `position` is the zero-based index in the destination column after the move. */
  onMoveCard: (cardId: number, columnId: number, position: number) => void;
  onAddCard: (columnId: number, title: string) => void;
  onOpenCard: (cardId: number) => void;
}

const END = Number.MAX_SAFE_INTEGER;

/** Prefer what is under the pointer; keyboard drags have no pointer, so fall back to corners. */
const collisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  return withinPointer.length > 0 ? withinPointer : closestCorners(args);
};

const instructions = {
  draggable:
    'To pick up a card, press space. Use the arrow keys to move it, space to drop it, escape to cancel. Press enter to open the card.',
};

export function Board({
  data,
  flags = DEFAULT_FLAGS,
  wipLimit = null,
  selectedCardId = null,
  onMoveCard,
  onAddCard,
  onOpenCard,
}: BoardProps) {
  // While dragging, `preview` is the board as it would look if dropped now.
  const [preview, setPreview] = useState<BoardPayload | null>(null);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const view = preview ?? data;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const activeCard =
    activeCardId === null
      ? null
      : (view.columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId) ?? null);

  const reset = () => {
    setPreview(null);
    setActiveCardId(null);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const parsed = parseDndId(active.id);
    if (parsed?.type === 'card') setActiveCardId(parsed.id);
    setPreview(data);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const a = parseDndId(active.id);
    const o = over ? parseDndId(over.id) : null;
    if (a?.type !== 'card' || !o || !over) return;
    const translated = active.rect.current.translated;
    setPreview((current) => {
      const base = current ?? data;
      const from = locateCard(base, a.id);
      if (!from) return base;
      if (o.type === 'column') {
        return from.columnId === o.id ? base : moveCardInBoard(base, a.id, o.id, END);
      }
      const target = locateCard(base, o.id);
      if (!target || target.columnId === from.columnId) return base;
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      return moveCardInBoard(base, a.id, target.columnId, target.index + (below ? 1 : 0));
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const base = preview ?? data;
    reset();
    const a = parseDndId(active.id);
    const o = over ? parseDndId(over.id) : null;
    if (a?.type !== 'card' || !o) return;

    let final = base;
    if (o.type === 'card') {
      const from = locateCard(base, a.id);
      const target = locateCard(base, o.id);
      if (from && target && from.columnId === target.columnId && from.index !== target.index) {
        final = moveCardInBoard(base, a.id, target.columnId, target.index);
      }
    }
    const dest = locateCard(final, a.id);
    const origin = locateCard(data, a.id);
    if (dest && (!origin || dest.columnId !== origin.columnId || dest.index !== origin.index)) {
      onMoveCard(a.id, dest.columnId, dest.index);
    }
  };

  const describe = (id: string | number) => {
    const parsed = parseDndId(id);
    if (!parsed) return 'item';
    if (parsed.type === 'column') {
      return `column ${view.columns.find((c) => c.id === parsed.id)?.name ?? ''}`;
    }
    const card = view.columns.flatMap((c) => c.cards).find((c) => c.id === parsed.id);
    return `card ${card?.title ?? ''}`;
  };

  const where = (id: string | number | undefined) => {
    const parsed = id === undefined ? null : parseDndId(id);
    if (!parsed) return '';
    const column =
      parsed.type === 'column'
        ? view.columns.find((c) => c.id === parsed.id)
        : view.columns.find((c) => c.cards.some((card) => card.id === parsed.id));
    return column ? ` in column ${column.name}` : '';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${describe(active.id)} is now${where(active.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${describe(active.id)}${where(active.id)}.`
        : `${describe(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Move cancelled. ${describe(active.id)} returned.`,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div className="tb-board" role="region" aria-label={`${data.board.name} board`}>
        {view.columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            flags={flags}
            wipLimit={wipLimit}
            selectedCardId={selectedCardId}
            onAddCard={onAddCard}
            onOpenCard={onOpenCard}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }}>
        {activeCard ? (
          <TaskCard
            overlay
            title={activeCard.title}
            labels={activeCard.labels}
            priority={activeCard.priority}
            assignee={activeCard.assignee}
            dueDate={activeCard.dueDate}
            commentCount={activeCard.commentCount}
            showDueDate={flags.dueDates}
            showComments={flags.cardComments}
            compact={flags.compactCards}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
