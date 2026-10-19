import { useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { User } from '../../lib/types';
import { Button } from '../Button/Button';
import './CommentForm.css';

export interface CommentFormProps {
  onSubmit: (body: string) => void;
  submitting?: boolean;
  /** Shown as "Commenting as ...". */
  author?: Pick<User, 'name'> | null;
  error?: string | null;
}

export function CommentForm({ onSubmit, submitting = false, author, error }: CommentFormProps) {
  const [body, setBody] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = body.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || submitting) return;
    onSubmit(trimmed);
    setBody('');
    inputRef.current?.focus();
  };

  return (
    <form className="tb-comment-form" onSubmit={submit}>
      <label className="tb-comment-form__label" htmlFor="tb-comment-body">
        Add a comment
        {author ? <span className="tb-comment-form__as"> as {author.name}</span> : null}
      </label>
      <textarea
        id="tb-comment-body"
        ref={inputRef}
        className="tb-comment-form__input"
        rows={2}
        value={body}
        placeholder="Write a comment..."
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
        }}
      />
      {error && (
        <p className="tb-comment-note tb-comment-note--error" role="alert">
          {error}
        </p>
      )}
      <div className="tb-comment-form__actions">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          icon={<Send size={14} aria-hidden="true" />}
          disabled={!trimmed}
          loading={submitting}
        >
          Comment
        </Button>
      </div>
    </form>
  );
}
