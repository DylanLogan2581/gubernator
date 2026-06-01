import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import {
  MANAGED_POPULATION_TYPE_SELECT,
  toManagedPopulationType,
  type ManagedPopulationTypeRow,
} from "./managedPopulationRow";
import { managedPopulationsQueryKeys } from "./managedPopulationsQueryKeys";

import type { ManagedPopulationType } from "../types/managedPopulationTypes";

type ManagedPopulationTypesByWorldQueryKey = ReturnType<
  typeof managedPopulationsQueryKeys.byWorld
>;
type ActiveManagedPopulationTypesByWorldQueryKey = ReturnType<
  typeof managedPopulationsQueryKeys.activeByWorld
>;
type ManagedPopulationTypeDetailQueryKey = ReturnType<
  typeof managedPopulationsQueryKeys.detail
>;

type ManagedPopulationTypesByWorldQueryOptions = UseQueryOptions<
  readonly ManagedPopulationType[],
  AuthUiError,
  readonly ManagedPopulationType[],
  ManagedPopulationTypesByWorldQueryKey
>;
type ActiveManagedPopulationTypesByWorldQueryOptions = UseQueryOptions<
  readonly ManagedPopulationType[],
  AuthUiError,
  readonly ManagedPopulationType[],
  ActiveManagedPopulationTypesByWorldQueryKey
>;
type ManagedPopulationTypeDetailQueryOptions = UseQueryOptions<
  ManagedPopulationType | null,
  AuthUiError,
  ManagedPopulationType | null,
  ManagedPopulationTypeDetailQueryKey
>;

export function managedPopulationTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ManagedPopulationTypesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getManagedPopulationTypesByWorld(c, worldId),
    queryKey: managedPopulationsQueryKeys.byWorld(worldId),
  });
}

export function activeManagedPopulationTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveManagedPopulationTypesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getActiveManagedPopulationTypesByWorld(c, worldId),
    queryKey: managedPopulationsQueryKeys.activeByWorld(worldId),
  });
}

export function managedPopulationTypeByIdQueryOptions(
  managedPopulationTypeId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ManagedPopulationTypeDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getManagedPopulationTypeById(c, managedPopulationTypeId),
    queryKey: managedPopulationsQueryKeys.detail(managedPopulationTypeId),
  });
}

async function getManagedPopulationTypesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly ManagedPopulationType[]> {
  const { data, error } = await client
    .from("managed_population_types")
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<ManagedPopulationTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toManagedPopulationType);
}

async function getActiveManagedPopulationTypesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly ManagedPopulationType[]> {
  const { data, error } = await client
    .from("managed_population_types")
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .eq("world_id", worldId)
    .eq("is_trashed", false)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<ManagedPopulationTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toManagedPopulationType);
}

async function getManagedPopulationTypeById(
  client: GubernatorSupabaseClient,
  managedPopulationTypeId: string,
): Promise<ManagedPopulationType | null> {
  const { data, error } = await client
    .from("managed_population_types")
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .eq("id", managedPopulationTypeId)
    .maybeSingle<ManagedPopulationTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toManagedPopulationType(data);
}
