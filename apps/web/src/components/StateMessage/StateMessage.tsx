import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Button } from '../Button/Button';
import './StateMessage.css';

export interface StateMessageProps {
  variant: 'empty' | 'error';
  title: string;
  description?: string;
  /** When given, an error state shows a retry button. */
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}

/** Full-area empty / error message. Errors are announced to assistive tech. */
export function StateMessage({
  variant,
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  children,
}: StateMessageProps) {
  const Icon = variant === 'error' ? AlertTriangle : Inbox;
  return (
    <div
      className={cx('tb-state', `tb-state--${variant}`)}
      role={variant === 'error' ? 'alert' : 'status'}
      data-testid={`state-${variant}`}
    >
      <span className="tb-state__icon">
        <Icon size={28} aria-hidden="true" />
      </span>
      <h2 className="tb-state__title">{title}</h2>
      {description && <p className="tb-state__description">{description}</p>}
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
