import { useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { moveCardInBoard } from '../lib/moveCard';
import { queryKeys } from '../lib/queryKeys';
import type { BoardPayload, CardPatch, NewCardInput, NewCommentInput } from '../lib/types';

/**
 * All write operations of a board page. Moves are optimistic: the cached board is rewritten
 * synchronously (so the card never snaps back while the request is in flight) and restored from a
 * snapshot if the API rejects the move.
 */
export function useBoardMutations(boardId: number) {
  const queryClient = useQueryClient();
  const boardKey = useMemo(() => queryKeys.board(boardId), [boardId]);
  const refreshBoard = () => queryClient.invalidateQueries({ queryKey: boardKey });

  const moveMutation = useMutation({
    mutationFn: (vars: {
      cardId: number;
      columnId: number;
      position: number;
      snapshot: BoardPayload;
    }) => api.updateCard(vars.cardId, { columnId: vars.columnId, position: vars.position }),
    onError: (_error, vars) => {
      queryClient.setQueryData(boardKey, vars.snapshot);
    },
    onSettled: refreshBoard,
  });
  const { mutate: mutateMove } = moveMutation;

  const moveCard = useCallback(
    (cardId: number, columnId: number, position: number) => {
      const snapshot = queryClient.getQueryData<BoardPayload>(boardKey);
      if (!snapshot) return;
      const next = moveCardInBoard(snapshot, cardId, columnId, position);
      if (next === snapshot) return;
      void queryClient.cancelQueries({ queryKey: boardKey });
      queryClient.setQueryData(boardKey, next); // synchronous: no frame with the old order
      mutateMove({ cardId, columnId, position, snapshot });
    },
    [queryClient, boardKey, mutateMove],
  );

  const addCard = useMutation({
    mutationFn: (input: NewCardInput) => api.createCard(input),
    onSettled: refreshBoard,
  });

  const updateCard = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CardPatch }) => api.updateCard(id, patch),
    onSettled: refreshBoard,
  });

  const deleteCard = useMutation({
    mutationFn: (id: number) => api.deleteCard(id),
    onSettled: refreshBoard,
  });

  const addComment = useMutation({
    mutationFn: ({ cardId, input }: { cardId: number; input: NewCommentInput }) =>
      api.createComment(cardId, input),
    onSettled: (_data, _error, { cardId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments(cardId) });
      return refreshBoard();
    },
  });

  return { moveCard, addCard, updateCard, deleteCard, addComment, moveError: moveMutation.error };
}
