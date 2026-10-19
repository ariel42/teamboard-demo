import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

/** The full board payload (columns, cards, users) for one board. */
export function useBoard(id: number) {
  return useQuery({
    queryKey: queryKeys.board(id),
    queryFn: () => api.getBoard(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}
