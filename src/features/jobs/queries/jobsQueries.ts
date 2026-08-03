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

export type JobsSortBy =
  | "name"
  | "type"
  | "education"
  | "capacity"
  | "tradersPerWorker";

export type JobsPageParams = {
  readonly educationLevelId?: string | null;
  readonly jobTypes?: readonly JobType[];
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sortBy?: JobsSortBy;
  readonly sortDirection?: "asc" | "desc";
  readonly trash: boolean;
};

export type JobsPage = {
  readonly items: readonly JobDefinition[];
  readonly totalCount: number;
};

type JobsPageQueryKey = ReturnType<typeof jobsQueryKeys.page>;
type JobsPageQueryOptions = UseQueryOptions<
  JobsPage,
  AuthUiError,
  JobsPage,
  JobsPageQueryKey
>;

// Config panel table (#1032): server-side search + pagination + trash
// filtering so the client only ever holds one page of jobs, not the whole
// world's list.
export function jobsPageQueryOptions(
  worldId: string,
  params: JobsPageParams,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): JobsPageQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryFn: () => getJobsPage(client, worldId, params),
    queryKey: jobsQueryKeys.page(worldId, params),
  };
}

async function getJobsPage(
  client: GubernatorSupabaseClient,
  worldId: string,
  params: JobsPageParams,
): Promise<JobsPage> {
  const pageStart = params.page * params.pageSize;
  const pageEnd = pageStart + params.pageSize - 1;
  const search = params.search?.trim() ?? "";

  let query = client
    .from("job_definitions")
    .select(JOB_SELECT, { count: "exact" })
    .eq("world_id", worldId)
    .eq("is_trashed", params.trash);

  if (params.jobTypes !== undefined && params.jobTypes.length > 0) {
    query = query.in("job_type", params.jobTypes);
  }

  if (
    params.educationLevelId !== undefined &&
    params.educationLevelId !== null
  ) {
    query = query.eq("required_education_level_id", params.educationLevelId);
  }

  if (search !== "") {
    query = query.ilike("name", `%${search}%`);
  }

  const sortAscending = params.sortDirection !== "desc";

  if (params.sortBy === "type") {
    query = query
      .order("job_type", { ascending: sortAscending })
      .order("name", { ascending: true });
  } else if (params.sortBy === "education") {
    query = query
      .order("rank", {
        ascending: sortAscending,
        nullsFirst: sortAscending,
        referencedTable: "education_levels",
      })
      .order("name", { ascending: true });
  } else if (params.sortBy === "capacity") {
    query = query
      .order("base_capacity", {
        ascending: sortAscending,
        nullsFirst: sortAscending,
      })
      .order("name", { ascending: true });
  } else if (params.sortBy === "tradersPerWorker") {
    query = query
      .order("trader_capacity_per_worker", {
        ascending: sortAscending,
        nullsFirst: sortAscending,
      })
      .order("name", { ascending: true });
  } else {
    query = query.order("name", { ascending: sortAscending });
  }

  const { data, error, count } = await query
    .order("id", { ascending: true })
    .range(pageStart, pageEnd)
    .returns<JobRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    items: data.map(toJob),
    totalCount: count ?? 0,
  };
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
