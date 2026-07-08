import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { CULTURE_SELECT, toCulture, type CultureRow } from "./cultureRow";
import { culturesQueryKeys } from "./culturesQueryKeys";

import type { Culture } from "../types/cultureTypes";

type CulturesByWorldQueryKey = ReturnType<typeof culturesQueryKeys.byWorld>;
type CultureDetailQueryKey = ReturnType<typeof culturesQueryKeys.detail>;

type CulturesByWorldQueryOptions = UseQueryOptions<
  readonly Culture[],
  AuthUiError,
  readonly Culture[],
  CulturesByWorldQueryKey
>;
type CultureDetailQueryOptions = UseQueryOptions<
  Culture | null,
  AuthUiError,
  Culture | null,
  CultureDetailQueryKey
>;

export function culturesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CulturesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getCulturesByWorld(c, worldId),
    queryKey: culturesQueryKeys.byWorld(worldId),
  });
}

export function cultureByIdQueryOptions(
  cultureId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CultureDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getCultureById(c, cultureId),
    queryKey: culturesQueryKeys.detail(cultureId),
  });
}

async function getCulturesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Culture[]> {
  const { data, error } = await client
    .from("cultures")
    .select(CULTURE_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<CultureRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCulture);
}

async function getCultureById(
  client: GubernatorSupabaseClient,
  cultureId: string,
): Promise<Culture | null> {
  const { data, error } = await client
    .from("cultures")
    .select(CULTURE_SELECT)
    .eq("id", cultureId)
    .maybeSingle<CultureRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toCulture(data);
}
