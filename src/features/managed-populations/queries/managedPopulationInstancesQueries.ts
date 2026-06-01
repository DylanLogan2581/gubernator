import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { managedPopulationsQueryKeys } from "./managedPopulationsQueryKeys";

import type {
  ManagedPopulationInstance,
  ManagedPopulationInstanceStatus,
} from "../types/managedPopulationInstanceTypes";

type ManagedPopulationTypeRow = {
  readonly culling_job: { readonly name: string };
  readonly husbandry_job: { readonly name: string };
  readonly name: string;
};

type ManagedPopulationInstanceRow = {
  readonly configured_cull_quantity: number;
  readonly created_at: string;
  readonly current_count: number;
  readonly id: string;
  readonly managed_population_type_id: string;
  readonly managed_population_types: ManagedPopulationTypeRow;
  readonly name: string;
  readonly settlement_id: string;
  readonly status: ManagedPopulationInstanceStatus;
  readonly updated_at: string;
};

const MANAGED_POPULATION_INSTANCE_SELECT = [
  "id,settlement_id,managed_population_type_id,name,current_count,configured_cull_quantity,status,created_at,updated_at",
  "managed_population_types(name,husbandry_job:job_definitions!managed_population_types_husbandry_job_fk(name),culling_job:job_definitions!managed_population_types_culling_job_fk(name))",
].join(",");

type ManagedPopulationInstancesBySettlementQueryKey = ReturnType<
  typeof managedPopulationsQueryKeys.instancesBySettlement
>;

type ManagedPopulationInstancesBySettlementQueryOptions = UseQueryOptions<
  readonly ManagedPopulationInstance[],
  AuthUiError,
  readonly ManagedPopulationInstance[],
  ManagedPopulationInstancesBySettlementQueryKey
>;

export function managedPopulationInstancesBySettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ManagedPopulationInstancesBySettlementQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getManagedPopulationInstancesBySettlement(c, settlementId),
    queryKey: managedPopulationsQueryKeys.instancesBySettlement(settlementId),
  });
}

async function getManagedPopulationInstancesBySettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly ManagedPopulationInstance[]> {
  const { data, error } = await client
    .from("managed_population_instances")
    .select(MANAGED_POPULATION_INSTANCE_SELECT)
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<ManagedPopulationInstanceRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toManagedPopulationInstance);
}

function toManagedPopulationInstance(
  row: ManagedPopulationInstanceRow,
): ManagedPopulationInstance {
  return {
    configuredCullQuantity: row.configured_cull_quantity,
    createdAt: row.created_at,
    cullingJobName: row.managed_population_types.culling_job.name,
    currentCount: row.current_count,
    husbandryJobName: row.managed_population_types.husbandry_job.name,
    id: row.id,
    managedPopulationTypeId: row.managed_population_type_id,
    managedPopulationTypeName: row.managed_population_types.name,
    name: row.name,
    settlementId: row.settlement_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
