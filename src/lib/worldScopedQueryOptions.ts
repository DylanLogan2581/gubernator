import {
  queryOptions,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

export function worldScopedQueryOptions<T, TKey extends QueryKey>({
  client,
  queryKey,
  fetcher,
}: {
  client: GubernatorSupabaseClient;
  queryKey: TKey;
  fetcher: (c: GubernatorSupabaseClient) => Promise<T>;
}): UseQueryOptions<T, Error, T, TKey> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions<T, Error, T, TKey>({
    queryKey,
    queryFn: () => fetcher(client),
  });
}
