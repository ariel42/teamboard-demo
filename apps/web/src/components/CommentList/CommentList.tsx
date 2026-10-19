import type { Comment as CommentModel } from '../../lib/types';
import { Comment } from '../Comment/Comment';
import './CommentList.css';

export interface CommentListProps {
  comments: CommentModel[];
  loading?: boolean;
  error?: string | null;
  now?: Date;
}

export function CommentList({ comments, loading = false, error = null, now }: CommentListProps) {
  if (error) {
    return (
      <p className="tb-comment-note tb-comment-note--error" role="alert">
        {error}
      </p>
    );
  }
  if (loading) {
    return (
      <div className="tb-comment-list" role="status" aria-busy="true" aria-label="Loading comments">
        <div className="tb-skeleton-line" />
        <div className="tb-skeleton-line tb-skeleton-line--short" />
      </div>
    );
  }
  if (comments.length === 0) {
    return <p className="tb-comment-note">No comments yet. Start the conversation.</p>;
  }
  return (
    <div className="tb-comment-list" role="list" aria-label="Comments">
      {comments.map((comment) => (
        <div role="listitem" key={comment.id}>
          <Comment
            author={comment.author}
            body={comment.body}
            createdAt={comment.createdAt}
            now={now}
          />
        </div>
      ))}
    </div>
  );
}
