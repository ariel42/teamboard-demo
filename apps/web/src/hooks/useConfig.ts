import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { resolveFlags, resolveWipLimit, toFlagItems } from '../lib/flags';
import { queryKeys } from '../lib/queryKeys';
import type { AppConfig } from '../lib/types';

/** App config from GET /api/config, with the feature flags resolved into typed booleans. */
export function useConfig() {
  const query = useQuery({
    queryKey: queryKeys.config,
    queryFn: api.getConfig,
    staleTime: 15_000,
  });
  const data = query.data;
  return useMemo(
    () => ({
      isLoading: query.isPending,
      isError: query.isError,
      env: data?.env,
      flags: resolveFlags(data?.flags),
      flagItems: toFlagItems(data?.flags),
      wipLimit: resolveWipLimit(data?.settings),
    }),
    [data, query.isPending, query.isError],
  );
}

/** PATCH /api/config/flags/:key, optimistic, rolled back if the request fails. */
export function useSetFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => api.setFlag(key, enabled),
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.config });
      const previous = queryClient.getQueryData<AppConfig>(queryKeys.config);
      if (previous) {
        queryClient.setQueryData<AppConfig>(queryKeys.config, {
          ...previous,
          flags: { ...previous.flags, [key]: enabled },
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.config, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.config }),
  });
}
