import { Navigate, useLocation } from 'react-router';
import { useBoards } from '../../hooks/useBoards';
import { BoardSkeleton } from '../../components/Skeleton/Skeleton';
import { StateMessage } from '../../components/StateMessage/StateMessage';

/** `/` has no content of its own: it forwards to the first board (keeping `?dir=` etc). */
export function BoardListRedirect() {
  const boards = useBoards();
  const location = useLocation();

  if (boards.isPending) return <BoardSkeleton />;
  if (boards.isError) {
    return (
      <StateMessage
        variant="error"
        title="Could not load boards"
        description={boards.error.message}
        onRetry={() => void boards.refetch()}
      />
    );
  }
  const first = boards.data[0];
  if (!first) {
    return (
      <StateMessage
        variant="empty"
        title="No boards yet"
        description="Run the database seed (npm run db:setup) to create the demo board."
      />
    );
  }
  return <Navigate to={{ pathname: `/boards/${first.id}`, search: location.search }} replace />;
}
