import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

/** Comments of one card; pass null to skip fetching (dialog closed or comments flag off). */
export function useComments(cardId: number | null) {
  return useQuery({
    queryKey: queryKeys.comments(cardId ?? 0),
    queryFn: () => api.listComments(cardId as number),
    enabled: cardId !== null,
  });
}
