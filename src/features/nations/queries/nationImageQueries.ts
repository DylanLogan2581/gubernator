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

import { nationsQueryKeys } from "./nationsQueryKeys";

export const NATION_IMAGES_BUCKET = "nation-images";
// Short-lived on purpose (signed URLs must not leak once world access is
// revoked); react-query's staleTime keeps refetches rare while a page is
// open. Mirrors src/features/worlds/queries/worldImageQueries.ts.
const SIGNED_URL_EXPIRY_SECONDS = 300;

type NationImageSignedUrlQueryKey = readonly [
  ...typeof nationsQueryKeys.all,
  "signed-url",
  string,
];
type NationImageSignedUrlQueryOptions = UseQueryOptions<
  string,
  AuthUiError,
  string,
  NationImageSignedUrlQueryKey
>;

function nationImageSignedUrlQueryKey(
  path: string,
): NationImageSignedUrlQueryKey {
  return [...nationsQueryKeys.all, "signed-url", path];
}

function nationImageSignedUrlQueryOptions(
  path: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationImageSignedUrlQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationImageSignedUrl(client, path),
    queryKey: nationImageSignedUrlQueryKey(path),
    staleTime: (SIGNED_URL_EXPIRY_SECONDS - 60) * 1000,
    gcTime: SIGNED_URL_EXPIRY_SECONDS * 1000,
  });
}

// Resolves a nation-images storage path (or null, e.g. no flag set yet) to a
// short-lived signed URL. Direct/public object URLs are denied by the
// bucket's RLS policies — a signed URL is the only way to read an image.
export function useNationImageSignedUrl(path: string | null): {
  readonly isLoading: boolean;
  readonly url: string | null;
} {
  const query = useQuery({
    ...nationImageSignedUrlQueryOptions(path ?? ""),
    enabled: path !== null && path !== "",
  });

  if (path === null || path === "") {
    return { isLoading: false, url: null };
  }

  return { isLoading: query.isPending, url: query.data ?? null };
}

async function getNationImageSignedUrl(
  client: GubernatorSupabaseClient,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(NATION_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.signedUrl;
}
