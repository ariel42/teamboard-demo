import { useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { AlertTriangle, Inbox, Plus } from 'lucide-react';
import { cx } from '../../lib/cx';
import { wipState } from '../../lib/flags';
import { Button } from '../Button/Button';
import './Column.css';

export interface ColumnProps {
  name: string;
  count: number;
  /** Max cards before the column is flagged; only used when `showWip` is true. */
  wipLimit?: number | null;
  /** Feature flag `wip_limits`. */
  showWip?: boolean;
  /** The cards. */
  children?: ReactNode;
  /** Called with the trimmed title when the inline composer is submitted. */
  onAddCard?: (title: string) => void;
  /** True while a card is dragged over this column. */
  highlighted?: boolean;
  /** Ref for the scrollable card list (used by the board as a drop target). */
  listRef?: Ref<HTMLDivElement>;
}

export function Column({
  name,
  count,
  wipLimit = null,
  showWip = false,
  children,
  onAddCard,
  highlighted = false,
  listRef,
}: ColumnProps) {
  const headingId = useId();
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const state = showWip && wipLimit ? wipState(count, wipLimit) : null;

  const close = () => {
    setComposing(false);
    setTitle('');
    requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddCard?.(trimmed);
    close();
  };

  return (
    <section
      className={cx(
        'tb-column',
        highlighted && 'tb-column--highlighted',
        state && `tb-column--wip-${state}`,
      )}
      aria-labelledby={headingId}
    >
      <header className="tb-column__header">
        <h2 className="tb-column__name" id={headingId}>
          {name}
        </h2>
        <span className="tb-column__count" data-testid="column-count">
          {state && wipLimit ? `${count} / ${wipLimit}` : count}
          <span className="sr-only"> cards{state && wipLimit ? `, limit ${wipLimit}` : ''}</span>
        </span>
        {state === 'at-limit' && (
          <span className="tb-column__wip tb-column__wip--warning">
            <AlertTriangle size={12} aria-hidden="true" />
            At limit
          </span>
        )}
        {state === 'over' && (
          <span className="tb-column__wip tb-column__wip--over" role="status">
            <AlertTriangle size={12} aria-hidden="true" />
            Over limit
          </span>
        )}
      </header>

      <div className="tb-column__list" ref={listRef}>
        {children}
        {count === 0 && (
          <div className="tb-column__empty">
            <Inbox size={20} aria-hidden="true" />
            <span>No cards yet</span>
          </div>
        )}
      </div>

      <footer className="tb-column__footer">
        {composing ? (
          <form className="tb-column__composer" onSubmit={submit}>
            <label className="sr-only" htmlFor={`${headingId}-title`}>
              Card title
            </label>
            <input
              id={`${headingId}-title`}
              className="tb-column__input"
              autoFocus
              value={title}
              placeholder="Card title"
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  close();
                }
              }}
            />
            <div className="tb-column__composer-actions">
              <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>
                Add
              </Button>
              <Button variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            ref={addButtonRef}
            variant="ghost"
            size="sm"
            className="tb-column__add"
            icon={<Plus size={16} aria-hidden="true" />}
            onClick={() => setComposing(true)}
            disabled={!onAddCard}
          >
            Add card
          </Button>
        )}
      </footer>
    </section>
  );
}
