import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { JOB_SELECT, toJob, type JobRow } from "./jobRow";
import { jobsQueryKeys } from "./jobsQueryKeys";

import type { JobDefinition, JobType } from "../types/jobTypes";

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

export function jobsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): JobsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getJobsByWorld(c, worldId),
    queryKey: jobsQueryKeys.byWorld(worldId),
  });
}

export function activeJobsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActiveJobsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getActiveJobsByWorld(c, worldId),
    queryKey: jobsQueryKeys.activeByWorld(worldId),
  });
}

export function jobsByTypeQueryOptions(
  worldId: string,
  jobType: JobType,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): JobsByTypeQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getJobsByType(c, worldId, jobType),
    queryKey: jobsQueryKeys.byType(worldId, jobType),
  });
}

export function jobByIdQueryOptions(
  jobId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): JobDetailQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getJobById(c, jobId),
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
