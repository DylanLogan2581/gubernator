import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import {
  DEPOSIT_TYPE_SELECT,
  toDepositType,
  type DepositTypeRow,
} from "./depositRow";
import { depositsQueryKeys } from "./depositsQueryKeys";

import type { DepositType } from "../types/depositTypes";

type DepositTypesByWorldQueryKey = ReturnType<typeof depositsQueryKeys.byWorld>;
type ActiveDepositTypesByWorldQueryKey = ReturnType<
  typeof depositsQueryKeys.activeByWorld
>;
type DepositTypeDetailQueryKey = ReturnType<typeof depositsQueryKeys.detail>;

type DepositTypesByWorldQueryOptions = UseQueryOptions<
  readonly DepositType[],
  AuthUiError,
  readonly DepositType[],
  DepositTypesByWorldQueryKey
>;
type ActiveDepositTypesByWorldQueryOptions = UseQueryOptions<
  readonly DepositType[],
  AuthUiError,
  readonly DepositType[],
  ActiveDepositTypesByWorldQueryKey
>;
type DepositTypeDetailQueryOptions = UseQueryOptions<
  DepositType | null,
  AuthUiError,
  DepositType | null,
  DepositTypeDetailQueryKey
>;

export function depositTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositTypesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositTypesByWorld(c, worldId),
    queryKey: depositsQueryKeys.byWorld(worldId),
  });
}

export function activeDepositTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveDepositTypesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getActiveDepositTypesByWorld(c, worldId),
    queryKey: depositsQueryKeys.activeByWorld(worldId),
  });
}

export function depositTypeByIdQueryOptions(
  depositTypeId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositTypeDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositTypeById(c, depositTypeId),
    queryKey: depositsQueryKeys.detail(depositTypeId),
  });
}

async function getDepositTypesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly DepositType[]> {
  const { data, error } = await client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<DepositTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDepositType);
}

async function getActiveDepositTypesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly DepositType[]> {
  const { data, error } = await client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT)
    .eq("world_id", worldId)
    .eq("is_trashed", false)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<DepositTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDepositType);
}

async function getDepositTypeById(
  client: GubernatorSupabaseClient,
  depositTypeId: string,
): Promise<DepositType | null> {
  const { data, error } = await client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT)
    .eq("id", depositTypeId)
    .maybeSingle<DepositTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toDepositType(data);
}
