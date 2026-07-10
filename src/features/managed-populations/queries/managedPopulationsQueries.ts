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

export type ManagedPopulationTypesSortBy =
  | "cullingJob"
  | "growthRate"
  | "husbandryJob"
  | "husbandryWorkersPerNAnimals"
  | "name";

export type ManagedPopulationTypesPageParams = {
  readonly cullingJobId?: string | null;
  readonly husbandryJobId?: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sortBy?: ManagedPopulationTypesSortBy;
  readonly sortDirection?: "asc" | "desc";
  readonly trash: boolean;
};

export type ManagedPopulationTypesPage = {
  readonly items: readonly ManagedPopulationType[];
  readonly totalCount: number;
};

type ManagedPopulationTypesPageQueryKey = ReturnType<
  typeof managedPopulationsQueryKeys.page
>;
type ManagedPopulationTypesPageQueryOptions = UseQueryOptions<
  ManagedPopulationTypesPage,
  AuthUiError,
  ManagedPopulationTypesPage,
  ManagedPopulationTypesPageQueryKey
>;

// Config panel table (#1032): server-side search + pagination + trash
// filtering so the client only ever holds one page of managed population
// types, not the whole world's list.
export function managedPopulationTypesPageQueryOptions(
  worldId: string,
  params: ManagedPopulationTypesPageParams,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ManagedPopulationTypesPageQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryFn: () => getManagedPopulationTypesPage(client, worldId, params),
    queryKey: managedPopulationsQueryKeys.page(worldId, params),
  };
}

async function getManagedPopulationTypesPage(
  client: GubernatorSupabaseClient,
  worldId: string,
  params: ManagedPopulationTypesPageParams,
): Promise<ManagedPopulationTypesPage> {
  const pageStart = params.page * params.pageSize;
  const pageEnd = pageStart + params.pageSize - 1;
  const search = params.search?.trim() ?? "";

  let query = client
    .from("managed_population_types")
    .select(MANAGED_POPULATION_TYPE_SELECT, { count: "exact" })
    .eq("world_id", worldId)
    .eq("is_trashed", params.trash);

  if (params.husbandryJobId !== undefined && params.husbandryJobId !== null) {
    query = query.eq("husbandry_job_id", params.husbandryJobId);
  }

  if (params.cullingJobId !== undefined && params.cullingJobId !== null) {
    query = query.eq("culling_job_id", params.cullingJobId);
  }

  if (search !== "") {
    query = query.ilike("name", `%${search}%`);
  }

  const sortAscending = params.sortDirection !== "desc";

  if (params.sortBy === "husbandryJob") {
    query = query
      .order("name", {
        ascending: sortAscending,
        referencedTable: "husbandry_job",
      })
      .order("name", { ascending: true });
  } else if (params.sortBy === "cullingJob") {
    query = query
      .order("name", {
        ascending: sortAscending,
        referencedTable: "culling_job",
      })
      .order("name", { ascending: true });
  } else if (params.sortBy === "growthRate") {
    query = query
      .order("growth_rate", { ascending: sortAscending })
      .order("name", { ascending: true });
  } else if (params.sortBy === "husbandryWorkersPerNAnimals") {
    query = query
      .order("husbandry_workers_per_n_animals", {
        ascending: sortAscending,
      })
      .order("name", { ascending: true });
  } else {
    query = query.order("name", { ascending: sortAscending });
  }

  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(pageStart, pageEnd)
    .returns<ManagedPopulationTypeRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    items: data.map(toManagedPopulationType),
    totalCount: count ?? 0,
  };
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
