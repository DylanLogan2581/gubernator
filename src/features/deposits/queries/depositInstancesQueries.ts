import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { depositsQueryKeys } from "./depositsQueryKeys";

import type {
  DepositInstance,
  DepositInstanceResource,
  DepositInstanceStatus,
} from "../types/depositInstanceTypes";

type DepositInstanceResourceRow = {
  readonly created_at: string;
  readonly deposit_instance_id: string;
  readonly id: string;
  readonly initial_quantity: number;
  readonly remaining_quantity: number;
  readonly resource_id: string;
  readonly resources: { readonly name: string };
  readonly updated_at: string;
};

type DepositInstanceRow = {
  readonly created_at: string;
  readonly deposit_instance_resources: readonly DepositInstanceResourceRow[];
  readonly deposit_type_id: string;
  readonly deposit_types: {
    readonly job: { readonly name: string };
    readonly name: string;
  };
  readonly discovered_by_event_id: string | null;
  readonly id: string;
  readonly max_workers: number | null;
  readonly name: string;
  readonly settlement_id: string;
  readonly status: DepositInstanceStatus;
  readonly updated_at: string;
};

type DepositInstanceWithLocationRow = {
  readonly created_at: string;
  readonly deposit_instance_resources: readonly DepositInstanceResourceRow[];
  readonly deposit_type_id: string;
  readonly deposit_types: {
    readonly job: { readonly name: string };
    readonly name: string;
  };
  readonly discovered_by_event_id: string | null;
  readonly id: string;
  readonly max_workers: number | null;
  readonly name: string;
  readonly settlement_id: string;
  readonly settlements: {
    readonly id: string;
    readonly name: string;
    readonly nations: { readonly name: string };
  };
  readonly status: DepositInstanceStatus;
  readonly updated_at: string;
};

export type DepositInstanceWithLocation = DepositInstance & {
  readonly settlementName: string;
  readonly nationName: string;
};

const DEPOSIT_INSTANCE_SELECT = [
  "id,settlement_id,deposit_type_id,name,status,max_workers,discovered_by_event_id,created_at,updated_at",
  "deposit_types(name,job:job_definitions!deposit_types_job_id_fk(name))",
  "deposit_instance_resources(id,deposit_instance_id,resource_id,initial_quantity,remaining_quantity,created_at,updated_at,resources(name))",
].join(",");

const DEPOSIT_INSTANCE_WITH_LOCATION_SELECT = [
  "id,settlement_id,deposit_type_id,name,status,max_workers,discovered_by_event_id,created_at,updated_at",
  "deposit_types(name,job:job_definitions!deposit_types_job_id_fk(name))",
  "deposit_instance_resources(id,deposit_instance_id,resource_id,initial_quantity,remaining_quantity,created_at,updated_at,resources(name))",
  "settlements(id,name,nations!inner(name))",
].join(",");

type DepositInstanceDetailQueryKey = ReturnType<
  typeof depositsQueryKeys.instanceById
>;

type DepositInstanceDetailQueryOptions = UseQueryOptions<
  DepositInstance | null,
  AuthUiError,
  DepositInstance | null,
  DepositInstanceDetailQueryKey
>;

export function depositInstanceByIdQueryOptions(
  instanceId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositInstanceDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositInstanceById(c, instanceId),
    queryKey: depositsQueryKeys.instanceById(instanceId),
  });
}

async function getDepositInstanceById(
  client: GubernatorSupabaseClient,
  instanceId: string,
): Promise<DepositInstance | null> {
  const { data, error } = await client
    .from("deposit_instances")
    .select(DEPOSIT_INSTANCE_SELECT)
    .eq("id", instanceId)
    .maybeSingle<DepositInstanceRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toDepositInstance(data);
}

type DepositInstancesBySettlementQueryKey = ReturnType<
  typeof depositsQueryKeys.instancesBySettlement
>;

type DepositInstancesBySettlementQueryOptions = UseQueryOptions<
  readonly DepositInstance[],
  AuthUiError,
  readonly DepositInstance[],
  DepositInstancesBySettlementQueryKey
>;

export function depositInstancesBySettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositInstancesBySettlementQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositInstancesBySettlement(c, settlementId),
    queryKey: depositsQueryKeys.instancesBySettlement(settlementId),
  });
}

async function getDepositInstancesBySettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly DepositInstance[]> {
  const { data, error } = await client
    .from("deposit_instances")
    .select(DEPOSIT_INSTANCE_SELECT)
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<DepositInstanceRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDepositInstance);
}

type DepositInstancesByNationsQueryKey = ReturnType<
  typeof depositsQueryKeys.instancesByNations
>;

type DepositInstancesByNationsQueryOptions = UseQueryOptions<
  readonly DepositInstanceWithLocation[],
  AuthUiError,
  readonly DepositInstanceWithLocation[],
  DepositInstancesByNationsQueryKey
>;

type DepositInstancesByWorldQueryKey = ReturnType<
  typeof depositsQueryKeys.instancesByWorld
>;

type DepositInstancesByWorldQueryOptions = UseQueryOptions<
  readonly DepositInstanceWithLocation[],
  AuthUiError,
  readonly DepositInstanceWithLocation[],
  DepositInstancesByWorldQueryKey
>;

export function depositInstancesByNationsQueryOptions(
  nationIds: readonly string[],
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositInstancesByNationsQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositInstancesByNations(c, nationIds),
    queryKey: depositsQueryKeys.instancesByNations(nationIds),
  });
}

export function depositInstancesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositInstancesByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getDepositInstancesByWorld(c, worldId),
    queryKey: depositsQueryKeys.instancesByWorld(worldId),
  });
}

async function getDepositInstancesByNations(
  client: GubernatorSupabaseClient,
  nationIds: readonly string[],
): Promise<readonly DepositInstanceWithLocation[]> {
  const { data, error } = await client
    .from("deposit_instances")
    .select(DEPOSIT_INSTANCE_WITH_LOCATION_SELECT)
    .in("settlements.nation_id", nationIds as string[])
    .order("settlements(name)", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<DepositInstanceWithLocationRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDepositInstanceWithLocation);
}

async function getDepositInstancesByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly DepositInstanceWithLocation[]> {
  const { data, error } = await client
    .from("deposit_instances")
    .select(DEPOSIT_INSTANCE_WITH_LOCATION_SELECT)
    .eq("settlements.nations.world_id", worldId)
    .order("settlements(name)", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<DepositInstanceWithLocationRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toDepositInstanceWithLocation);
}

function toDepositInstance(row: DepositInstanceRow): DepositInstance {
  return {
    createdAt: row.created_at,
    depositTypeId: row.deposit_type_id,
    depositTypeJobName: row.deposit_types.job.name,
    depositTypeName: row.deposit_types.name,
    discoveredByEventId: row.discovered_by_event_id,
    id: row.id,
    maxWorkers: row.max_workers,
    name: row.name,
    resources: row.deposit_instance_resources.map(toDepositInstanceResource),
    settlementId: row.settlement_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toDepositInstanceWithLocation(
  row: DepositInstanceWithLocationRow,
): DepositInstanceWithLocation {
  return {
    createdAt: row.created_at,
    depositTypeId: row.deposit_type_id,
    depositTypeJobName: row.deposit_types.job.name,
    depositTypeName: row.deposit_types.name,
    discoveredByEventId: row.discovered_by_event_id,
    id: row.id,
    maxWorkers: row.max_workers,
    name: row.name,
    resources: row.deposit_instance_resources.map(toDepositInstanceResource),
    settlementId: row.settlement_id,
    settlementName: row.settlements.name,
    nationName: row.settlements.nations.name,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toDepositInstanceResource(
  row: DepositInstanceResourceRow,
): DepositInstanceResource {
  return {
    createdAt: row.created_at,
    depositInstanceId: row.deposit_instance_id,
    id: row.id,
    initialQuantity: row.initial_quantity,
    remainingQuantity: row.remaining_quantity,
    resourceId: row.resource_id,
    resourceName: row.resources.name,
    updatedAt: row.updated_at,
  };
}
