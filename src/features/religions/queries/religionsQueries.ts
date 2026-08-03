import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { RELIGION_SELECT, toReligion, type ReligionRow } from "./religionRow";
import { religionsQueryKeys } from "./religionsQueryKeys";

import type { Religion } from "../types/religionTypes";

type ReligionsByWorldQueryKey = ReturnType<typeof religionsQueryKeys.byWorld>;
type ReligionDetailQueryKey = ReturnType<typeof religionsQueryKeys.detail>;
type ReligionUsageQueryKey = ReturnType<typeof religionsQueryKeys.usage>;

type ReligionsByWorldQueryOptions = UseQueryOptions<
  readonly Religion[],
  AuthUiError,
  readonly Religion[],
  ReligionsByWorldQueryKey
>;
type ReligionDetailQueryOptions = UseQueryOptions<
  Religion | null,
  AuthUiError,
  Religion | null,
  ReligionDetailQueryKey
>;

export type ReligionUsage = {
  readonly citizenCount: number;
  readonly nationCount: number;
};

type ReligionUsageQueryOptions = UseQueryOptions<
  ReligionUsage,
  AuthUiError,
  ReligionUsage,
  ReligionUsageQueryKey
>;

export function religionsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ReligionsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getReligionsByWorld(c, worldId),
    queryKey: religionsQueryKeys.byWorld(worldId),
  });
}

export function religionByIdQueryOptions(
  religionId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ReligionDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getReligionById(c, religionId),
    queryKey: religionsQueryKeys.detail(religionId),
  });
}

export function religionUsageQueryOptions(
  religionId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ReligionUsageQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getReligionUsage(c, religionId),
    queryKey: religionsQueryKeys.usage(religionId),
  });
}

async function getReligionsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Religion[]> {
  const { data, error } = await client
    .from("religions")
    .select(RELIGION_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<ReligionRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toReligion);
}

async function getReligionById(
  client: GubernatorSupabaseClient,
  religionId: string,
): Promise<Religion | null> {
  const { data, error } = await client
    .from("religions")
    .select(RELIGION_SELECT)
    .eq("id", religionId)
    .maybeSingle<ReligionRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toReligion(data);
}

async function getReligionUsage(
  client: GubernatorSupabaseClient,
  religionId: string,
): Promise<ReligionUsage> {
  const [citizens, nations] = await Promise.all([
    client
      .from("citizens")
      .select("id", { count: "exact", head: true })
      .eq("religion_id", religionId),
    client
      .from("nations")
      .select("id", { count: "exact", head: true })
      .eq("state_religion_id", religionId),
  ]);

  if (citizens.error !== null) {
    throw normalizeSupabaseError(citizens.error);
  }
  if (nations.error !== null) {
    throw normalizeSupabaseError(nations.error);
  }

  return {
    citizenCount: citizens.count ?? 0,
    nationCount: nations.count ?? 0,
  };
}
