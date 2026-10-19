import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api';
import { queryKeys } from '../../lib/queryKeys';
import { useBoard } from '../../hooks/useBoard';
import { useBoardMutations } from '../../hooks/useBoardMutations';
import { useComments } from '../../hooks/useComments';
import { useConfig } from '../../hooks/useConfig';
import { Board } from '../../components/Board/Board';
import { BoardSkeleton } from '../../components/Skeleton/Skeleton';
import { CardDialog } from '../../components/CardDialog/CardDialog';
import { StateMessage } from '../../components/StateMessage/StateMessage';
import './BoardPage.css';

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

/** Container for one board: owns the data fetching, the optimistic mutations and the open card. */
export function BoardPage() {
  const params = useParams();
  const boardId = Number(params.boardId);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const board = useBoard(boardId);
  const config = useConfig();
  const { moveCard, addCard, updateCard, deleteCard, addComment, moveError } =
    useBoardMutations(boardId);

  const selectedCardId = Number(searchParams.get('card')) || null;
  const selected = (() => {
    if (!board.data || selectedCardId === null) return null;
    for (const column of board.data.columns) {
      const card = column.cards.find((c) => c.id === selectedCardId);
      if (card) return { card, columnName: column.name };
    }
    return null;
  })();

  const comments = useComments(selected && config.flags.cardComments ? selected.card.id : null);

  const openCard = useCallback(
    (id: number) => {
      const next = new URLSearchParams(searchParams);
      next.set('card', String(id));
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );
  const closeCard = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('card');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!Number.isInteger(boardId) || boardId < 1) {
    return (
      <StateMessage
        variant="error"
        title="Board not found"
        description="That board id is not valid."
      />
    );
  }
  if (board.isPending) return <BoardSkeleton />;
  if (board.isError) {
    const notFound = board.error instanceof ApiError && board.error.status === 404;
    return (
      <StateMessage
        variant="error"
        title={notFound ? 'Board not found' : 'Could not load the board'}
        description={messageOf(board.error)}
        onRetry={notFound ? undefined : () => void board.refetch()}
      />
    );
  }

  const data = board.data;
  const cardCount = data.columns.reduce((n, c) => n + c.cards.length, 0);
  // Comments are posted as the signed-in env user when a board user has that name, else the first user.
  const envUser = config.env?.user.toLowerCase();
  const commentAuthor =
    data.users.find((u) => u.name.toLowerCase() === envUser) ?? data.users[0] ?? null;
  const actionError = addCard.error ?? moveError ?? null;

  return (
    <div className="tb-board-page">
      <div className="tb-board-page__header">
        <div>
          <h1 className="tb-board-page__title">{data.board.name}</h1>
          {data.board.description && (
            <p className="tb-board-page__description">{data.board.description}</p>
          )}
        </div>
        <p className="tb-board-page__meta">
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </p>
      </div>

      {actionError && (
        <p className="tb-board-page__banner" role="alert">
          {moveError && !addCard.error
            ? `Could not move the card, it was put back. ${messageOf(moveError)}`
            : messageOf(actionError)}
        </p>
      )}

      <Board
        data={data}
        flags={config.flags}
        wipLimit={config.wipLimit}
        selectedCardId={selected?.card.id ?? null}
        onMoveCard={moveCard}
        onAddCard={(columnId, title) => addCard.mutate({ columnId, title })}
        onOpenCard={openCard}
      />

      {selected && (
        <CardDialog
          key={selected.card.id}
          card={selected.card}
          columnName={selected.columnName}
          users={data.users}
          flags={config.flags}
          comments={comments.data ?? []}
          commentsLoading={comments.isPending && config.flags.cardComments}
          commentsError={comments.isError ? messageOf(comments.error) : null}
          commentAuthor={commentAuthor}
          commentSubmitting={addComment.isPending}
          commentSubmitError={addComment.isError ? messageOf(addComment.error) : null}
          saving={updateCard.isPending}
          deleting={deleteCard.isPending}
          error={
            updateCard.isError
              ? messageOf(updateCard.error)
              : deleteCard.isError
                ? messageOf(deleteCard.error)
                : null
          }
          onClose={() => {
            updateCard.reset();
            deleteCard.reset();
            addComment.reset();
            closeCard();
          }}
          onSave={(patch) =>
            updateCard.mutate({ id: selected.card.id, patch }, { onSuccess: closeCard })
          }
          onDelete={() =>
            deleteCard.mutate(selected.card.id, {
              onSuccess: () => {
                queryClient.removeQueries({ queryKey: queryKeys.comments(selected.card.id) });
                closeCard();
              },
            })
          }
          onAddComment={(body) => {
            if (!commentAuthor) return;
            addComment.mutate({
              cardId: selected.card.id,
              input: { authorId: commentAuthor.id, body },
            });
          }}
        />
      )}
    </div>
  );
}
