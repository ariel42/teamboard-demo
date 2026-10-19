import { formatRelativeTime } from '../../lib/dates';
import type { User } from '../../lib/types';
import { Avatar } from '../Avatar/Avatar';
import './Comment.css';

export interface CommentProps {
  author: User;
  body: string;
  /** ISO timestamp */
  createdAt: string;
  now?: Date;
}

export function Comment({ author, body, createdAt, now }: CommentProps) {
  return (
    <article className="tb-comment">
      <Avatar {...author} size="md" decorative />
      <div className="tb-comment__content">
        <header className="tb-comment__header">
          <span className="tb-comment__author">{author.name}</span>
          <time className="tb-comment__time" dateTime={createdAt}>
            {formatRelativeTime(createdAt, now)}
          </time>
        </header>
        <p className="tb-comment__body">{body}</p>
      </div>
    </article>
  );
}
