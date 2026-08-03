import {
  queryOptions,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { settlementsQueryKeys } from "./settlementsQueryKeys";

export const SETTLEMENT_IMAGES_BUCKET = "settlement-images";
// Short-lived on purpose (signed URLs must not leak once world access is
// revoked); react-query's staleTime keeps refetches rare while a page is open.
// Mirrors src/features/nations/queries/nationImageQueries.ts.
const SIGNED_URL_EXPIRY_SECONDS = 300;

type SettlementImageSignedUrlQueryKey = readonly [
  ...typeof settlementsQueryKeys.all,
  "signed-url",
  string,
];
type SettlementImageSignedUrlQueryOptions = UseQueryOptions<
  string,
  AuthUiError,
  string,
  SettlementImageSignedUrlQueryKey
>;

function settlementImageSignedUrlQueryKey(
  path: string,
): SettlementImageSignedUrlQueryKey {
  return [...settlementsQueryKeys.all, "signed-url", path];
}

function settlementImageSignedUrlQueryOptions(
  path: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementImageSignedUrlQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementImageSignedUrl(client, path),
    queryKey: settlementImageSignedUrlQueryKey(path),
    staleTime: (SIGNED_URL_EXPIRY_SECONDS - 60) * 1000,
    gcTime: SIGNED_URL_EXPIRY_SECONDS * 1000,
  });
}

// Resolves a settlement-images storage path (or null, e.g. no flag set yet) to
// a short-lived signed URL. Direct/public object URLs are denied by the
// bucket's RLS policies — a signed URL is the only way to read an image.
export function useSettlementImageSignedUrl(path: string | null): {
  readonly isLoading: boolean;
  readonly url: string | null;
} {
  const query = useQuery({
    ...settlementImageSignedUrlQueryOptions(path ?? ""),
    enabled: path !== null && path !== "",
  });

  if (path === null || path === "") {
    return { isLoading: false, url: null };
  }

  return { isLoading: query.isPending, url: query.data ?? null };
}

async function getSettlementImageSignedUrl(
  client: GubernatorSupabaseClient,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(SETTLEMENT_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.signedUrl;
}
