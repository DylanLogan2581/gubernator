import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { jobsQueryKeys } from "./jobsQueryKeys";

import type { JobDefinition, JobIoEntry, JobType } from "../types/jobTypes";

type JobsByWorldQueryKey = ReturnType<typeof jobsQueryKeys.byWorld>;
type ActiveJobsByWorldQueryKey = ReturnType<typeof jobsQueryKeys.activeByWorld>;
type JobsByTypeQueryKey = ReturnType<typeof jobsQueryKeys.byType>;
type JobDetailQueryKey = ReturnType<typeof jobsQueryKeys.detail>;

type JobsByWorldQueryOptions = UseQueryOptions<
  readonly JobDefinition[],
  AuthUiError,
  readonly JobDefinition[],
  JobsByWorldQueryKey
>;
type ActiveJobsByWorldQueryOptions = UseQueryOptions<
  readonly JobDefinition[],
  AuthUiError,
  readonly JobDefinition[],
  ActiveJobsByWorldQueryKey
>;
type JobsByTypeQueryOptions = UseQueryOptions<
  readonly JobDefinition[],
  AuthUiError,
  readonly JobDefinition[],
  JobsByTypeQueryKey
>;
type JobDetailQueryOptions = UseQueryOptions<
  JobDefinition | null,
  AuthUiError,
  JobDefinition | null,
  JobDetailQueryKey
>;

type JobIoEntryRow = {
  readonly amount_per_worker: number;
  readonly notes?: string;
  readonly resource_id: string;
};

type JobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  // Embedded FK references — used to compute hasActiveReferences.
  // deposit_types!deposit_types_job_id_fk: deposit type that has this job
  // husbandry_mpt: mpt that designates this as husbandry job
  // culling_mpt: mpt that designates this as culling job
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly JobIoEntryRow[];
  readonly is_trashed: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: readonly JobIoEntryRow[];
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

const JOB_SELECT = [
  "id,world_id,name,slug,job_type,base_capacity,trader_capacity_per_worker",
  "linked_deposit_type_id,linked_managed_population_type_id",
  "inputs_json,outputs_json,is_trashed,created_at,updated_at",
  "deposit_types!deposit_types_job_id_fk(id)",
  "husbandry_mpt:managed_population_types!managed_population_types_husbandry_job_fk(id)",
  "culling_mpt:managed_population_types!managed_population_types_culling_job_fk(id)",
].join(",");

export function jobsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): JobsByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getJobsByWorld(client, worldId),
    queryKey: jobsQueryKeys.byWorld(worldId),
  });
}

export function activeJobsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveJobsByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getActiveJobsByWorld(client, worldId),
    queryKey: jobsQueryKeys.activeByWorld(worldId),
  });
}

export function jobsByTypeQueryOptions(
  worldId: string,
  jobType: JobType,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): JobsByTypeQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getJobsByType(client, worldId, jobType),
    queryKey: jobsQueryKeys.byType(worldId, jobType),
  });
}

export function jobByIdQueryOptions(
  jobId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): JobDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getJobById(client, jobId),
    queryKey: jobsQueryKeys.detail(jobId),
  });
}

async function getJobsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly JobDefinition[]> {
  const { data, error } = await client
    .from("job_definitions")
    .select(JOB_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<JobRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toJob);
}

async function getActiveJobsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly JobDefinition[]> {
  const { data, error } = await client
    .from("job_definitions")
    .select(JOB_SELECT)
    .eq("world_id", worldId)
    .eq("is_trashed", false)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<JobRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toJob);
}

async function getJobsByType(
  client: GubernatorSupabaseClient,
  worldId: string,
  jobType: JobType,
): Promise<readonly JobDefinition[]> {
  const { data, error } = await client
    .from("job_definitions")
    .select(JOB_SELECT)
    .eq("world_id", worldId)
    .eq("job_type", jobType)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<JobRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toJob);
}

async function getJobById(
  client: GubernatorSupabaseClient,
  jobId: string,
): Promise<JobDefinition | null> {
  const { data, error } = await client
    .from("job_definitions")
    .select(JOB_SELECT)
    .eq("id", jobId)
    .maybeSingle<JobRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toJob(data);
}

function toJobIoEntry(row: JobIoEntryRow): JobIoEntry {
  const entry: { amountPerWorker: number; notes?: string; resourceId: string } =
    {
      amountPerWorker: row.amount_per_worker,
      resourceId: row.resource_id,
    };
  if (row.notes !== undefined) {
    entry.notes = row.notes;
  }
  return entry;
}

function toJob(row: JobRow): JobDefinition {
  return {
    baseCapacity: row.base_capacity,
    createdAt: row.created_at,
    hasActiveReferences:
      row.deposit_types.length > 0 ||
      row.husbandry_mpt.length > 0 ||
      row.culling_mpt.length > 0,
    id: row.id,
    inputsJson: row.inputs_json.map(toJobIoEntry),
    isTrashed: row.is_trashed,
    jobType: row.job_type as JobType,
    linkedDepositTypeId: row.linked_deposit_type_id,
    linkedManagedPopulationTypeId: row.linked_managed_population_type_id,
    name: row.name,
    outputsJson: row.outputs_json.map(toJobIoEntry),
    slug: row.slug,
    traderCapacityPerWorker: row.trader_capacity_per_worker,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
