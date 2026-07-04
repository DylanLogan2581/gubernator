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

import { worldQueryKeys } from "./worldQueryKeys";

export const WORLD_IMAGES_BUCKET = "world-images";
// Short-lived on purpose (signed URLs must not leak once a world goes
// private/access is revoked); react-query's staleTime keeps refetches rare
// while a page is open.
const SIGNED_URL_EXPIRY_SECONDS = 300;

const WORLD_IMAGES_SELECT = "hero_path,thumbnail_path";

export type WorldImagePaths = {
  readonly heroPath: string | null;
  readonly thumbnailPath: string | null;
};

type WorldImagesQueryKey = ReturnType<typeof worldQueryKeys.images>;
type WorldImagesQueryOptions = UseQueryOptions<
  WorldImagePaths,
  AuthUiError,
  WorldImagePaths,
  WorldImagesQueryKey
>;
type WorldImageSignedUrlQueryKey = readonly [
  ...typeof worldQueryKeys.all,
  "signed-url",
  string,
];
type WorldImageSignedUrlQueryOptions = UseQueryOptions<
  string,
  AuthUiError,
  string,
  WorldImageSignedUrlQueryKey
>;

export function worldImagesQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldImagesQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldImagePaths(client, worldId),
    queryKey: worldQueryKeys.images(worldId),
  });
}

function worldImageSignedUrlQueryKey(
  path: string,
): WorldImageSignedUrlQueryKey {
  return [...worldQueryKeys.all, "signed-url", path];
}

function worldImageSignedUrlQueryOptions(
  path: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldImageSignedUrlQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldImageSignedUrl(client, path),
    queryKey: worldImageSignedUrlQueryKey(path),
    staleTime: (SIGNED_URL_EXPIRY_SECONDS - 60) * 1000,
    gcTime: SIGNED_URL_EXPIRY_SECONDS * 1000,
  });
}

// Resolves a world-images storage path (or null, e.g. no thumbnail set yet)
// to a short-lived signed URL. Direct/public object URLs are denied by the
// bucket's RLS policies — a signed URL is the only way to read an image.
export function useWorldImageSignedUrl(path: string | null): {
  readonly isLoading: boolean;
  readonly url: string | null;
} {
  const query = useQuery({
    ...worldImageSignedUrlQueryOptions(path ?? ""),
    enabled: path !== null && path !== "",
  });

  if (path === null || path === "") {
    return { isLoading: false, url: null };
  }

  return { isLoading: query.isPending, url: query.data ?? null };
}

async function getWorldImagePaths(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldImagePaths> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_IMAGES_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    heroPath: data?.hero_path ?? null,
    thumbnailPath: data?.thumbnail_path ?? null,
  };
}

async function getWorldImageSignedUrl(
  client: GubernatorSupabaseClient,
  path: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(WORLD_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.signedUrl;
}
