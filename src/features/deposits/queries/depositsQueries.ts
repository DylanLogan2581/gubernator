import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { depositsQueryKeys } from "./depositsQueryKeys";

import type { DepositType, WorkerInputEntry } from "../types/depositTypes";

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

type WorkerInputEntryRow = {
  readonly amount_per_worker: number;
  readonly resource_id: string;
};

type DepositTypeRow = {
  readonly created_at: string;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly job_id: string;
  // Embedded FK references — job_definitions whose linked_deposit_type_id = this id.
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly name: string;
  readonly output_units_per_worker: number;
  readonly slug: string;
  readonly updated_at: string;
  readonly worker_inputs_json: readonly WorkerInputEntryRow[];
  readonly world_id: string;
};

const DEPOSIT_TYPE_SELECT = [
  "id,world_id,name,slug,job_id,output_units_per_worker,worker_inputs_json,is_trashed,created_at,updated_at",
  "referencing_jobs:job_definitions!job_definitions_linked_deposit_type_fk(id)",
].join(",");

export function depositTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositTypesByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getDepositTypesByWorld(client, worldId),
    queryKey: depositsQueryKeys.byWorld(worldId),
  });
}

export function activeDepositTypesByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveDepositTypesByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getActiveDepositTypesByWorld(client, worldId),
    queryKey: depositsQueryKeys.activeByWorld(worldId),
  });
}

export function depositTypeByIdQueryOptions(
  depositTypeId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): DepositTypeDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getDepositTypeById(client, depositTypeId),
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

function toWorkerInputEntry(row: WorkerInputEntryRow): WorkerInputEntry {
  return {
    amountPerWorker: row.amount_per_worker,
    resourceId: row.resource_id,
  };
}

function toDepositType(row: DepositTypeRow): DepositType {
  return {
    createdAt: row.created_at,
    hasActiveReferences: row.referencing_jobs.length > 0,
    id: row.id,
    isTrashed: row.is_trashed,
    jobId: row.job_id,
    name: row.name,
    outputUnitsPerWorker: row.output_units_per_worker,
    slug: row.slug,
    updatedAt: row.updated_at,
    workerInputsJson: row.worker_inputs_json.map(toWorkerInputEntry),
    worldId: row.world_id,
  };
}
