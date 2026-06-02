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

const DEPOSIT_INSTANCE_SELECT = [
  "id,settlement_id,deposit_type_id,name,status,max_workers,discovered_by_event_id,created_at,updated_at",
  "deposit_types(name,job:job_definitions!deposit_types_job_id_fk(name))",
  "deposit_instance_resources(id,deposit_instance_id,resource_id,initial_quantity,remaining_quantity,created_at,updated_at,resources(name))",
].join(",");

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
