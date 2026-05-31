import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Json } from "@/types/database";

import { jobsQueryKeys } from "../queries/jobsQueryKeys";
import {
  createJobInputSchema,
  hardDeleteJobInputSchema,
  restoreJobInputSchema,
  softDeleteJobInputSchema,
  updateJobInputSchema,
  type CreateJobInput,
  type HardDeleteJobInput,
  type RestoreJobInput,
  type SoftDeleteJobInput,
  type UpdateJobInput,
} from "../schemas/jobSchemas";

import type {
  HardDeleteJobResult,
  JobDefinition,
  JobIoEntry,
  JobType,
  RestoreJobResult,
  SoftDeleteJobResult,
} from "../types/jobTypes";
import type { z } from "zod";

type JobMutationErrorCode =
  | "job_input_invalid"
  | "job_not_authorized"
  | "job_not_found";

type CreateJobMutationOptions = UseMutationOptions<
  JobDefinition,
  AuthUiError | JobMutationError,
  CreateJobInput
>;
type UpdateJobMutationOptions = UseMutationOptions<
  JobDefinition,
  AuthUiError | JobMutationError,
  UpdateJobInput
>;
type SoftDeleteJobMutationOptions = UseMutationOptions<
  SoftDeleteJobResult,
  AuthUiError | JobMutationError,
  SoftDeleteJobInput
>;
type RestoreJobMutationOptions = UseMutationOptions<
  RestoreJobResult,
  AuthUiError | JobMutationError,
  RestoreJobInput
>;
type HardDeleteJobMutationOptions = UseMutationOptions<
  HardDeleteJobResult,
  AuthUiError | JobMutationError,
  HardDeleteJobInput
>;

// Explicit typed insert/update payloads prevent RejectExcessProperties conflicts
// in Supabase's strict overloads.
type JobInsertPayload = {
  base_capacity?: number | null;
  inputs_json?: Json;
  job_type: string;
  linked_deposit_type_id?: string | null;
  linked_managed_population_type_id?: string | null;
  name: string;
  outputs_json?: Json;
  slug: string;
  trader_capacity_per_worker?: number | null;
  world_id: string;
};

type JobUpdatePayload = {
  base_capacity?: number | null;
  inputs_json?: Json;
  linked_deposit_type_id?: string | null;
  linked_managed_population_type_id?: string | null;
  name?: string;
  outputs_json?: Json;
  slug?: string;
  trader_capacity_per_worker?: number | null;
};

type JobIoEntryRow = {
  readonly amount_per_worker: number;
  readonly notes?: string;
  readonly resource_id: string;
};

type JobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
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

const JOB_SELECT =
  "id,world_id,name,slug,job_type,base_capacity,trader_capacity_per_worker,linked_deposit_type_id,linked_managed_population_type_id,inputs_json,outputs_json,is_trashed,created_at,updated_at";

export type JobMutationIssue = MutationIssue;

export const { ErrorClass: JobMutationError, isError: isJobMutationError } =
  createMutationError<JobMutationErrorCode>("JobMutationError");
export type JobMutationError = InstanceType<typeof JobMutationError>;

export function createJobMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateJobMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateJobInput) => createJob(client, input),
    mutationKey: [...jobsQueryKeys.all, "create-job"],
    onSuccess: async (job): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.byWorld(job.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.activeByWorld(job.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.byType(job.worldId, job.jobType),
        }),
      ]);
    },
  });
}

export function updateJobMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateJobMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateJobInput) => updateJob(client, input),
    mutationKey: [...jobsQueryKeys.all, "update-job"],
    onSuccess: async (job): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.byWorld(job.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.activeByWorld(job.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.byType(job.worldId, job.jobType),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.detail(job.id),
        }),
      ]);
    },
  });
}

export function softDeleteJobMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SoftDeleteJobMutationOptions {
  return mutationOptions({
    mutationFn: (input: SoftDeleteJobInput) => softDeleteJob(client, input),
    mutationKey: [...jobsQueryKeys.all, "soft-delete-job"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.activeByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.detail(result.jobId),
        }),
      ]);
    },
  });
}

export function restoreJobMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RestoreJobMutationOptions {
  return mutationOptions({
    mutationFn: (input: RestoreJobInput) => restoreJob(client, input),
    mutationKey: [...jobsQueryKeys.all, "restore-job"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.activeByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.detail(result.jobId),
        }),
      ]);
    },
  });
}

export function hardDeleteJobMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): HardDeleteJobMutationOptions {
  return mutationOptions({
    mutationFn: (input: HardDeleteJobInput) => hardDeleteJob(client, input),
    mutationKey: [...jobsQueryKeys.all, "hard-delete-job"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: jobsQueryKeys.activeByWorld(result.worldId),
        }),
      ]);
    },
  });
}

async function createJob(
  client: GubernatorSupabaseClient,
  input: CreateJobInput,
): Promise<JobDefinition> {
  const values = parseInput(createJobInputSchema, input);

  const insertPayload: JobInsertPayload = {
    inputs_json: toIoJson(values.inputsJson ?? []),
    job_type: values.jobType,
    name: values.name.trim(),
    outputs_json: toIoJson(values.outputsJson ?? []),
    slug: values.slug.trim(),
    world_id: values.worldId,
  };

  switch (values.jobType) {
    case "standard":
    case "construction":
      insertPayload.base_capacity = values.baseCapacity;
      break;
    case "trader":
      insertPayload.trader_capacity_per_worker = values.traderCapacityPerWorker;
      break;
    case "deposit":
      insertPayload.linked_deposit_type_id = values.linkedDepositTypeId;
      break;
    case "husbandry":
    case "culling":
      insertPayload.linked_managed_population_type_id =
        values.linkedManagedPopulationTypeId;
      break;
  }

  const { data, error } = await client
    .from("job_definitions")
    .insert(insertPayload)
    .select(JOB_SELECT)
    .maybeSingle<JobRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new JobMutationError({
      code: "job_not_found",
      message: "Job could not be created.",
    });
  }

  return toJob(data);
}

async function updateJob(
  client: GubernatorSupabaseClient,
  input: UpdateJobInput,
): Promise<JobDefinition> {
  const values = parseInput(updateJobInputSchema, input);

  const updatePayload: JobUpdatePayload = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.slug !== undefined) {
    updatePayload.slug = values.slug.trim();
  }
  if (values.baseCapacity !== undefined) {
    updatePayload.base_capacity = values.baseCapacity;
  }
  if (values.traderCapacityPerWorker !== undefined) {
    updatePayload.trader_capacity_per_worker = values.traderCapacityPerWorker;
  }
  if (values.linkedDepositTypeId !== undefined) {
    updatePayload.linked_deposit_type_id = values.linkedDepositTypeId;
  }
  if (values.linkedManagedPopulationTypeId !== undefined) {
    updatePayload.linked_managed_population_type_id =
      values.linkedManagedPopulationTypeId;
  }
  if (values.inputsJson !== undefined) {
    updatePayload.inputs_json = toIoJson(values.inputsJson);
  }
  if (values.outputsJson !== undefined) {
    updatePayload.outputs_json = toIoJson(values.outputsJson);
  }

  const { data, error } = await client
    .from("job_definitions")
    .update(updatePayload)
    .eq("id", values.jobId)
    .eq("world_id", values.worldId)
    .select(JOB_SELECT)
    .maybeSingle<JobRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new JobMutationError({
      code: "job_not_found",
      message: "Job could not be updated.",
    });
  }

  return toJob(data);
}

async function softDeleteJob(
  client: GubernatorSupabaseClient,
  input: SoftDeleteJobInput,
): Promise<SoftDeleteJobResult> {
  const values = parseInput(softDeleteJobInputSchema, input);

  const { data, error } = await client
    .rpc("soft_delete_job_definition", {
      p_job_id: values.jobId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new JobMutationError({
        code: "job_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new JobMutationError({
      code: "job_not_found",
      message: "Job could not be trashed.",
    });
  }

  return { jobId: data.id, worldId: data.world_id };
}

async function restoreJob(
  client: GubernatorSupabaseClient,
  input: RestoreJobInput,
): Promise<RestoreJobResult> {
  const values = parseInput(restoreJobInputSchema, input);

  const { data, error } = await client
    .rpc("restore_job_definition", {
      p_job_id: values.jobId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new JobMutationError({
        code: "job_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new JobMutationError({
      code: "job_not_found",
      message: "Job could not be restored.",
    });
  }

  return { jobId: data.id, worldId: data.world_id };
}

async function hardDeleteJob(
  client: GubernatorSupabaseClient,
  input: HardDeleteJobInput,
): Promise<HardDeleteJobResult> {
  const values = parseInput(hardDeleteJobInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_job_definition", {
      p_job_id: values.jobId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new JobMutationError({
        code: "job_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new JobMutationError({
      code: "job_not_found",
      message: "Job could not be permanently deleted.",
    });
  }

  return { jobId: data.id, worldId: data.world_id };
}

// Converts camelCase IO entries to a JSON-compatible DB format.
function toIoJson(entries: readonly JobIoEntry[]): Json {
  return entries.map(
    (e): Record<string, Json | undefined> => ({
      amount_per_worker: e.amountPerWorker,
      ...(e.notes !== undefined ? { notes: e.notes } : {}),
      resource_id: e.resourceId,
    }),
  );
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
    hasActiveReferences: false,
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

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new JobMutationError({
        code: "job_input_invalid",
        issues,
        message: "Job input is invalid.",
      }),
  );
}
