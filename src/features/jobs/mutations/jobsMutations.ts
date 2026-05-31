import { normalizeSupabaseError } from "@/features/auth";
import { buildTrashLifecycleMutations } from "@/lib/buildTrashLifecycleMutations";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import { toSnakeCaseEntries } from "@/lib/toSnakeCaseEntries";
import type { Json } from "@/types/database";

import { JOB_SELECT, toJob, type JobRow } from "../queries/jobRow";
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
  RestoreJobResult,
  SoftDeleteJobResult,
} from "../types/jobTypes";
import type { z } from "zod";

type JobMutationErrorCode =
  | "job_input_invalid"
  | "job_not_authorized"
  | "job_not_found";

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

export type JobMutationIssue = MutationIssue;

export const { ErrorClass: JobMutationError, isError: isJobMutationError } =
  createMutationError<JobMutationErrorCode>("JobMutationError");
export type JobMutationError = InstanceType<typeof JobMutationError>;

const jobMutations = buildTrashLifecycleMutations<
  JobDefinition,
  CreateJobInput,
  UpdateJobInput,
  SoftDeleteJobInput,
  SoftDeleteJobResult,
  RestoreJobInput,
  RestoreJobResult,
  HardDeleteJobInput,
  HardDeleteJobResult
>({
  actionNames: {
    create: "create-job",
    hardDelete: "hard-delete-job",
    restore: "restore-job",
    softDelete: "soft-delete-job",
    update: "update-job",
  },
  extraOnSuccess: {
    create: async (queryClient, job) => {
      await queryClient.invalidateQueries({
        queryKey: jobsQueryKeys.byType(job.worldId, job.jobType),
      });
    },
    update: async (queryClient, job) => {
      await queryClient.invalidateQueries({
        queryKey: jobsQueryKeys.byType(job.worldId, job.jobType),
      });
    },
  },
  getDetailId: {
    restore: (result) => result.jobId,
    softDelete: (result) => result.jobId,
  },
  mutationFns: {
    create: createJob,
    hardDelete: hardDeleteJob,
    restore: restoreJob,
    softDelete: softDeleteJob,
    update: updateJob,
  },
  queryKeys: {
    activeByWorld: jobsQueryKeys.activeByWorld,
    all: jobsQueryKeys.all,
    byWorld: jobsQueryKeys.byWorld,
    detail: jobsQueryKeys.detail,
  },
});

export const createJobMutationOptions = jobMutations.create;
export const updateJobMutationOptions = jobMutations.update;
export const softDeleteJobMutationOptions = jobMutations.softDelete;
export const restoreJobMutationOptions = jobMutations.restore;
export const hardDeleteJobMutationOptions = jobMutations.hardDelete;

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

function toIoJson(entries: readonly JobIoEntry[]): Json {
  return toSnakeCaseEntries(entries, {
    amountPerWorker: "amount_per_worker",
    notes: "notes",
    resourceId: "resource_id",
  });
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
