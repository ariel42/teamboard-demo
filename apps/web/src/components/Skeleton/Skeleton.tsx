import { cx } from '../../lib/cx';
import './Skeleton.css';

export interface SkeletonProps {
  className?: string;
  /** Inline size, e.g. "60%" or "120px". */
  width?: string;
  height?: string;
}

/** Shimmering placeholder block (the shimmer stops with reduced motion). */
export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <span
      className={cx('tb-skeleton', className)}
      style={{ inlineSize: width, blockSize: height }}
      aria-hidden="true"
    />
  );
}

export interface BoardSkeletonProps {
  columns?: number;
}

/** Placeholder shaped like the board while it loads. */
export function BoardSkeleton({ columns = 4 }: BoardSkeletonProps) {
  return (
    <div
      className="tb-board-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading board"
      data-testid="board-skeleton"
    >
      {Array.from({ length: columns }, (_, c) => (
        <div className="tb-board-skeleton__column" key={c}>
          <Skeleton width="45%" height="18px" />
          {Array.from({ length: 3 - (c % 2) }, (_, i) => (
            <div className="tb-board-skeleton__card" key={i}>
              <Skeleton width="85%" height="14px" />
              <Skeleton width="55%" height="12px" />
              <Skeleton width="30%" height="20px" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
