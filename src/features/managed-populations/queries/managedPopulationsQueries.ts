import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { managedPopulationsQueryKeys } from "./managedPopulationsQueryKeys";

import type {
  ManagedPopulationType,
  PopulationResourceEntry,
} from "../types/managedPopulationTypes";

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

type PopulationResourceEntryRow = {
  readonly amount_per_n_animals: number;
  readonly resource_id: string;
};

type ManagedPopulationTypeRow = {
  readonly created_at: string;
  readonly culling_job_id: string;
  readonly culling_outputs_json: readonly PopulationResourceEntryRow[];
  readonly growth_rate: number;
  readonly husbandry_job_id: string;
  readonly husbandry_workers_per_n_animals: number;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly maintenance_rules_json: readonly PopulationResourceEntryRow[];
  readonly name: string;
  // Embedded FK references — job_definitions whose linked_managed_population_type_id = this id.
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

const MANAGED_POPULATION_TYPE_SELECT = [
  "id,world_id,name,slug,husbandry_job_id,culling_job_id",
  "husbandry_workers_per_n_animals,growth_rate",
  "maintenance_rules_json,culling_outputs_json,is_trashed,created_at,updated_at",
  "referencing_jobs:job_definitions!job_definitions_linked_managed_pop_type_fk(id)",
].join(",");

export function managedPopulationTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ManagedPopulationTypesByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getManagedPopulationTypesByWorld(client, worldId),
    queryKey: managedPopulationsQueryKeys.byWorld(worldId),
  });
}

export function activeManagedPopulationTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveManagedPopulationTypesByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getActiveManagedPopulationTypesByWorld(client, worldId),
    queryKey: managedPopulationsQueryKeys.activeByWorld(worldId),
  });
}

export function managedPopulationTypeByIdQueryOptions(
  managedPopulationTypeId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ManagedPopulationTypeDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () =>
      getManagedPopulationTypeById(client, managedPopulationTypeId),
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

function toPopulationResourceEntry(
  row: PopulationResourceEntryRow,
): PopulationResourceEntry {
  return {
    amountPerNAnimals: row.amount_per_n_animals,
    resourceId: row.resource_id,
  };
}

function toManagedPopulationType(
  row: ManagedPopulationTypeRow,
): ManagedPopulationType {
  return {
    createdAt: row.created_at,
    cullingJobId: row.culling_job_id,
    cullingOutputsJson: row.culling_outputs_json.map(toPopulationResourceEntry),
    growthRate: row.growth_rate,
    hasActiveReferences: row.referencing_jobs.length > 0,
    husbandryJobId: row.husbandry_job_id,
    husbandryWorkersPerNAnimals: row.husbandry_workers_per_n_animals,
    id: row.id,
    isTrashed: row.is_trashed,
    maintenanceRulesJson: row.maintenance_rules_json.map(
      toPopulationResourceEntry,
    ),
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
