import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

export function useBoards() {
  return useQuery({ queryKey: queryKeys.boards, queryFn: api.listBoards });
}
