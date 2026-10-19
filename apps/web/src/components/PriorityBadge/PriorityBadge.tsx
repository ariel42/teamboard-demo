import { ArrowDown, ArrowUp, Equal, Flame, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import type { Priority } from '../../lib/types';
import './PriorityBadge.css';

const META: Record<Priority, { label: string; Icon: LucideIcon }> = {
  low: { label: 'Low', Icon: ArrowDown },
  medium: { label: 'Medium', Icon: Equal },
  high: { label: 'High', Icon: ArrowUp },
  urgent: { label: 'Urgent', Icon: Flame },
};

export interface PriorityBadgeProps {
  priority: Priority;
  /** Icon only (the label stays available to assistive tech). */
  iconOnly?: boolean;
  className?: string;
}

/** Priority is conveyed by icon and text as well as color. */
export function PriorityBadge({ priority, iconOnly = false, className }: PriorityBadgeProps) {
  const { label, Icon } = META[priority];
  return (
    <span
      className={cx(
        'tb-priority',
        `tb-priority--${priority}`,
        iconOnly && 'tb-priority--icon',
        className,
      )}
      title={iconOnly ? `${label} priority` : undefined}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      <span className={iconOnly ? 'sr-only' : undefined}>{label}</span>
    </span>
  );
}
