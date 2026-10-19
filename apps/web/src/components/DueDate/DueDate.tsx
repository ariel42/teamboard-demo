import { CalendarClock, Calendar } from 'lucide-react';
import { cx } from '../../lib/cx';
import { formatDueDate } from '../../lib/dates';
import './DueDate.css';

export interface DueDateProps {
  /** "YYYY-MM-DD" */
  dueDate: string;
  /** Injectable clock, for stories and tests. */
  now?: Date;
  className?: string;
}

export function DueDate({ dueDate, now, className }: DueDateProps) {
  const { text, status } = formatDueDate(dueDate, now);
  const Icon = status === 'overdue' ? CalendarClock : Calendar;
  return (
    <time
      className={cx('tb-due', `tb-due--${status}`, className)}
      dateTime={dueDate}
      title={status === 'overdue' ? `Overdue: due ${dueDate}` : `Due ${dueDate}`}
    >
      <Icon size={12} aria-hidden="true" />
      {status === 'overdue' && <span className="sr-only">Overdue: </span>}
      {text}
    </time>
  );
}
