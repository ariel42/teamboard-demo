import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { DEFAULT_FLAGS, type Flags } from '../../lib/flags';
import { PRIORITIES } from '../../lib/types';
import type {
  BoardPayloadCard,
  CardPatch,
  Comment as CommentModel,
  Priority,
  User,
} from '../../lib/types';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Button } from '../Button/Button';
import { CommentForm } from '../CommentForm/CommentForm';
import { CommentList } from '../CommentList/CommentList';
import { Label } from '../Label/Label';
import './CardDialog.css';

export interface CardDialogProps {
  card: BoardPayloadCard;
  columnName: string;
  users: User[];
  flags?: Flags;
  comments?: CommentModel[];
  commentsLoading?: boolean;
  commentsError?: string | null;
  /** The user comments are posted as. */
  commentAuthor?: User | null;
  commentSubmitting?: boolean;
  commentSubmitError?: string | null;
  saving?: boolean;
  deleting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (patch: CardPatch) => void;
  onDelete: () => void;
  onAddComment: (body: string) => void;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/**
 * Accessible modal for one card: focus is trapped inside, Escape and the backdrop close it, and
 * focus returns to the card that opened it. Edits are kept in a draft until "Save changes".
 */
export function CardDialog({
  card,
  columnName,
  users,
  flags = DEFAULT_FLAGS,
  comments = [],
  commentsLoading = false,
  commentsError = null,
  commentAuthor = null,
  commentSubmitting = false,
  commentSubmitError = null,
  saving = false,
  deleting = false,
  error = null,
  onClose,
  onSave,
  onDelete,
  onAddComment,
}: CardDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [assigneeId, setAssigneeId] = useState<number | null>(card.assignee?.id ?? null);
  const [dueDate, setDueDate] = useState(card.dueDate ?? '');
  const [labels, setLabels] = useState<string[]>(card.labels);
  const [labelDraft, setLabelDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const trimmedTitle = title.trim();

  const addLabel = () => {
    const value = labelDraft.trim();
    if (value && !labels.some((l) => l.toLowerCase() === value.toLowerCase())) {
      setLabels([...labels, value]);
    }
    setLabelDraft('');
  };

  const onLabelKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addLabel();
    } else if (event.key === 'Backspace' && labelDraft === '' && labels.length > 0) {
      setLabels(labels.slice(0, -1));
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedTitle || saving) return;
    const pendingLabel = labelDraft.trim();
    const finalLabels =
      pendingLabel && !labels.includes(pendingLabel) ? [...labels, pendingLabel] : labels;
    const patch: CardPatch = {
      title: trimmedTitle,
      description,
      priority,
      assigneeId,
      labels: finalLabels,
    };
    if (flags.dueDates) patch.dueDate = dueDate || null;
    onSave(patch);
  };

  const titleId = `${uid}-title`;

  return createPortal(
    <div
      className="tb-dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="tb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-heading`}
        data-testid="card-dialog"
        tabIndex={-1}
      >
        <header className="tb-dialog__header">
          <div>
            <h2 className="tb-dialog__heading" id={`${uid}-heading`}>
              Edit card
            </h2>
            <p className="tb-dialog__sub">
              in <strong>{columnName}</strong>
            </p>
          </div>
          <Button variant="ghost" iconOnly aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </Button>
        </header>

        <div className="tb-dialog__body">
          <form className="tb-dialog__form" id={`${uid}-form`} onSubmit={submit}>
            <div className="tb-field">
              <label htmlFor={titleId}>Title</label>
              <input
                id={titleId}
                className="tb-input"
                data-autofocus
                value={title}
                maxLength={200}
                required
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="tb-field">
              <label htmlFor={`${uid}-desc`}>Description</label>
              <textarea
                id={`${uid}-desc`}
                className="tb-input tb-input--area"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="tb-dialog__row">
              <div className="tb-field">
                <label htmlFor={`${uid}-priority`}>Priority</label>
                <select
                  id={`${uid}-priority`}
                  className="tb-input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tb-field">
                <label htmlFor={`${uid}-assignee`}>Assignee</label>
                <select
                  id={`${uid}-assignee`}
                  className="tb-input"
                  value={assigneeId ?? ''}
                  onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              {flags.dueDates && (
                <div className="tb-field">
                  <label htmlFor={`${uid}-due`}>Due date</label>
                  <input
                    id={`${uid}-due`}
                    className="tb-input"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="tb-field">
              <label htmlFor={`${uid}-label`}>Labels</label>
              <div className="tb-dialog__labels">
                {labels.map((name) => (
                  <span className="tb-dialog__chip" key={name}>
                    <Label name={name} />
                    <button
                      type="button"
                      className="tb-dialog__chip-remove"
                      aria-label={`Remove label ${name}`}
                      onClick={() => setLabels(labels.filter((l) => l !== name))}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  id={`${uid}-label`}
                  className="tb-dialog__label-input"
                  value={labelDraft}
                  placeholder="Add label, press Enter"
                  maxLength={40}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onKeyDown={onLabelKeyDown}
                  onBlur={addLabel}
                />
              </div>
            </div>

            {error && (
              <p className="tb-dialog__error" role="alert">
                {error}
              </p>
            )}
          </form>

          {flags.cardComments && (
            <section className="tb-dialog__comments" aria-labelledby={`${uid}-comments`}>
              <h3 className="tb-dialog__section" id={`${uid}-comments`}>
                Comments
              </h3>
              <CommentList comments={comments} loading={commentsLoading} error={commentsError} />
              <CommentForm
                onSubmit={onAddComment}
                submitting={commentSubmitting}
                author={commentAuthor}
                error={commentSubmitError}
              />
            </section>
          )}
        </div>

        <footer className="tb-dialog__footer">
          {confirmDelete ? (
            <div className="tb-dialog__confirm" role="group" aria-label="Confirm delete">
              <span>Delete this card?</span>
              <Button variant="danger" size="sm" loading={deleting} onClick={onDelete}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="tb-dialog__delete"
              icon={<Trash2 size={16} aria-hidden="true" />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
          <div className="tb-dialog__actions">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={`${uid}-form`}
              variant="primary"
              loading={saving}
              disabled={!trimmedTitle}
            >
              Save changes
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
