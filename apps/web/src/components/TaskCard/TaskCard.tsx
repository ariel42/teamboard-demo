import type { HTMLAttributes, Ref } from 'react';
import { MessageSquare } from 'lucide-react';
import { cx } from '../../lib/cx';
import type { Priority, User } from '../../lib/types';
import { Avatar } from '../Avatar/Avatar';
import { DueDate } from '../DueDate/DueDate';
import { Label } from '../Label/Label';
import { PriorityBadge } from '../PriorityBadge/PriorityBadge';
import './TaskCard.css';

export interface TaskCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  labels?: string[];
  priority: Priority;
  assignee?: User | null;
  /** "YYYY-MM-DD" */
  dueDate?: string | null;
  commentCount?: number;
  /** Feature flag `due_dates`. */
  showDueDate?: boolean;
  /** Feature flag `card_comments`. */
  showComments?: boolean;
  /** Feature flag `compact_cards`: title, priority icon and assignee only. */
  compact?: boolean;
  /** This card is the one being dragged (the in-place ghost). */
  dragging?: boolean;
  /** Rendered inside the DragOverlay: lifted and slightly rotated. */
  overlay?: boolean;
  selected?: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function TaskCard({
  title,
  labels = [],
  priority,
  assignee = null,
  dueDate = null,
  commentCount = 0,
  showDueDate = true,
  showComments = true,
  compact = false,
  dragging = false,
  overlay = false,
  selected = false,
  className,
  ref,
  ...rest
}: TaskCardProps) {
  const hasFooter =
    !compact && ((showDueDate && dueDate) || (showComments && commentCount > 0) || assignee);
  return (
    <div
      ref={ref}
      className={cx(
        'tb-card',
        compact && 'tb-card--compact',
        dragging && 'tb-card--dragging',
        overlay && 'tb-card--overlay',
        selected && 'tb-card--selected',
        className,
      )}
      data-priority={priority}
      aria-pressed={selected || undefined}
      {...rest}
    >
      {!compact && labels.length > 0 && (
        <div className="tb-card__labels">
          {labels.map((label) => (
            <Label key={label} name={label} />
          ))}
        </div>
      )}
      <div className="tb-card__main">
        <p className="tb-card__title">{title}</p>
        {compact && (
          <div className="tb-card__compact-meta">
            <PriorityBadge priority={priority} iconOnly />
            {assignee && <Avatar {...assignee} size="xs" />}
          </div>
        )}
      </div>
      {!compact && (
        <div className="tb-card__meta">
          <PriorityBadge priority={priority} />
          {showDueDate && dueDate && <DueDate dueDate={dueDate} />}
          {showComments && commentCount > 0 && (
            <span className="tb-card__comments" title={`${commentCount} comments`}>
              <MessageSquare size={12} aria-hidden="true" />
              <span aria-hidden="true">{commentCount}</span>
              <span className="sr-only">{commentCount} comments</span>
            </span>
          )}
          {hasFooter && assignee && (
            <span className="tb-card__assignee">
              <Avatar {...assignee} size="sm" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
