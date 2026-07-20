import { normalizeSupabaseError } from "@/features/auth";
import { buildTrashLifecycleMutations } from "@/lib/buildTrashLifecycleMutations";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import { toSnakeCaseEntries } from "@/lib/toSnakeCaseEntries";
import type { Json } from "@/types/database";

import {
  DEPOSIT_TYPE_SELECT,
  toDepositType,
  type DepositTypeRow,
} from "../queries/depositRow";
import { depositsQueryKeys } from "../queries/depositsQueryKeys";
import {
  createDepositTypeInputSchema,
  hardDeleteDepositTypeInputSchema,
  restoreDepositTypeInputSchema,
  softDeleteDepositTypeInputSchema,
  updateDepositTypeInputSchema,
  type CreateDepositTypeInput,
  type DepositTypeJobValues,
  type HardDeleteDepositTypeInput,
  type RestoreDepositTypeInput,
  type SoftDeleteDepositTypeInput,
  type UpdateDepositTypeInput,
} from "../schemas/depositSchemas";

import type {
  DepositType,
  HardDeleteDepositTypeResult,
  RestoreDepositTypeResult,
  SoftDeleteDepositTypeResult,
} from "../types/depositTypes";
import type { z } from "zod";

type DepositTypeMutationErrorCode =
  | "deposit_type_input_invalid"
  | "deposit_type_job_already_linked"
  | "deposit_type_not_authorized"
  | "deposit_type_not_found"
  | "deposit_type_tier_already_used";

// Explicit typed payloads prevent RejectExcessProperties conflicts in Supabase's strict overloads.
type DepositTypeInsertPayload = {
  icon?: string | null;
  icon_color?: number | null;
  name: string;
  slug: string;
  world_id: string;
};

type DepositTypeUpdatePayload = {
  icon?: string | null;
  icon_color?: number | null;
  name?: string;
  slug?: string;
};

// world_id is redundant with deposit_type_id (a BEFORE INSERT trigger would
// derive it if omitted) but the generated Supabase types require it on
// insert, so it's passed through explicitly from the parent mutation's
// worldId.
type DepositTypeJobInsertPayload = {
  deposit_type_id: string;
  job_id: string;
  tier_number: number;
  output_units_per_worker: number;
  worker_inputs_json?: Json;
  world_id: string;
};

export type DepositTypeMutationIssue = MutationIssue;

export const {
  ErrorClass: DepositTypeMutationError,
  isError: isDepositTypeMutationError,
} = createMutationError<DepositTypeMutationErrorCode>(
  "DepositTypeMutationError",
);
export type DepositTypeMutationError = InstanceType<
  typeof DepositTypeMutationError
>;

const depositTypeMutations = buildTrashLifecycleMutations<
  DepositType,
  CreateDepositTypeInput,
  UpdateDepositTypeInput,
  SoftDeleteDepositTypeInput,
  SoftDeleteDepositTypeResult,
  RestoreDepositTypeInput,
  RestoreDepositTypeResult,
  HardDeleteDepositTypeInput,
  HardDeleteDepositTypeResult
>({
  actionNames: {
    create: "create-deposit-type",
    hardDelete: "hard-delete-deposit-type",
    restore: "restore-deposit-type",
    softDelete: "soft-delete-deposit-type",
    update: "update-deposit-type",
  },
  getDetailId: {
    restore: (result) => result.depositTypeId,
    softDelete: (result) => result.depositTypeId,
  },
  mutationFns: {
    create: createDepositType,
    hardDelete: hardDeleteDepositType,
    restore: restoreDepositType,
    softDelete: softDeleteDepositType,
    update: updateDepositType,
  },
  queryKeys: {
    activeByWorld: depositsQueryKeys.activeByWorld,
    all: depositsQueryKeys.all,
    byWorld: depositsQueryKeys.byWorld,
    detail: depositsQueryKeys.detail,
  },
});

export const createDepositTypeMutationOptions = depositTypeMutations.create;
export const updateDepositTypeMutationOptions = depositTypeMutations.update;
export const softDeleteDepositTypeMutationOptions =
  depositTypeMutations.softDelete;
export const restoreDepositTypeMutationOptions = depositTypeMutations.restore;
export const hardDeleteDepositTypeMutationOptions =
  depositTypeMutations.hardDelete;

async function createDepositType(
  client: GubernatorSupabaseClient,
  input: CreateDepositTypeInput,
): Promise<DepositType> {
  const values = parseInput(createDepositTypeInputSchema, input);

  const insertPayload: DepositTypeInsertPayload = {
    icon: values.icon ?? null,
    icon_color: values.iconColor ?? null,
    name: values.name.trim(),
    slug: values.slug.trim(),
    world_id: values.worldId,
  };

  const { data: insertedRow, error: insertError } = await client
    .from("deposit_types")
    .insert(insertPayload)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (insertError !== null) {
    throw normalizeSupabaseError(insertError);
  }
  if (insertedRow === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be created.",
    });
  }

  await insertDepositTypeJobs(
    client,
    insertedRow.id,
    values.worldId,
    values.jobs,
  );

  return fetchDepositTypeById(client, insertedRow.id);
}

async function updateDepositType(
  client: GubernatorSupabaseClient,
  input: UpdateDepositTypeInput,
): Promise<DepositType> {
  const values = parseInput(updateDepositTypeInputSchema, input);

  const updatePayload: DepositTypeUpdatePayload = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.slug !== undefined) {
    updatePayload.slug = values.slug.trim();
  }
  if (values.icon !== undefined) {
    updatePayload.icon = values.icon;
  }
  if (values.iconColor !== undefined) {
    updatePayload.icon_color = values.iconColor;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { data, error } = await client
      .from("deposit_types")
      .update(updatePayload)
      .eq("id", values.depositTypeId)
      .eq("world_id", values.worldId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error !== null) {
      throw normalizeSupabaseError(error);
    }
    if (data === null) {
      throw new DepositTypeMutationError({
        code: "deposit_type_not_found",
        message: "Deposit type could not be updated.",
      });
    }
  } else {
    const { data, error } = await client
      .from("deposit_types")
      .select("id")
      .eq("id", values.depositTypeId)
      .eq("world_id", values.worldId)
      .maybeSingle<{ id: string }>();

    if (error !== null) {
      throw normalizeSupabaseError(error);
    }
    if (data === null) {
      throw new DepositTypeMutationError({
        code: "deposit_type_not_found",
        message: "Deposit type could not be updated.",
      });
    }
  }

  if (values.jobs !== undefined) {
    await replaceDepositTypeJobs(
      client,
      values.depositTypeId,
      values.worldId,
      values.jobs,
    );
  }

  return fetchDepositTypeById(client, values.depositTypeId);
}

// No DB transaction wraps the delete+insert below: deposit_type_jobs
// mutations are admin-only, low-frequency, and RLS-gated, so a client-side
// sequential replace is an acceptable trade-off for the join-table shape
// (see issue #1246).
async function replaceDepositTypeJobs(
  client: GubernatorSupabaseClient,
  depositTypeId: string,
  worldId: string,
  jobs: readonly DepositTypeJobValues[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("deposit_type_jobs")
    .delete()
    .eq("deposit_type_id", depositTypeId);

  if (deleteError !== null) {
    throw normalizeSupabaseError(deleteError);
  }

  await insertDepositTypeJobs(client, depositTypeId, worldId, jobs);
}

async function insertDepositTypeJobs(
  client: GubernatorSupabaseClient,
  depositTypeId: string,
  worldId: string,
  jobs: readonly DepositTypeJobValues[],
): Promise<void> {
  const insertPayload: DepositTypeJobInsertPayload[] = jobs.map((job) => ({
    deposit_type_id: depositTypeId,
    job_id: job.jobId,
    tier_number: job.tierNumber,
    output_units_per_worker: job.outputUnitsPerWorker,
    worker_inputs_json: toWorkerInputsJson(job.workerInputsJson),
    world_id: worldId,
  }));

  const { error } = await client
    .from("deposit_type_jobs")
    .insert(insertPayload);

  if (error !== null) {
    if (isDuplicateJobInDepositTypeConflict(error)) {
      throw new DepositTypeMutationError({
        code: "deposit_type_job_already_linked",
        message: "Each job may only be linked once per deposit type.",
      });
    }
    if (isDuplicateTierInDepositTypeConflict(error)) {
      throw new DepositTypeMutationError({
        code: "deposit_type_tier_already_used",
        message: "Each tier number may only be used once per deposit type.",
      });
    }
    throw normalizeSupabaseError(error);
  }
}

async function fetchDepositTypeById(
  client: GubernatorSupabaseClient,
  depositTypeId: string,
): Promise<DepositType> {
  const { data, error } = await client
    .from("deposit_types")
    .select(DEPOSIT_TYPE_SELECT)
    .eq("id", depositTypeId)
    .maybeSingle<DepositTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
  if (data === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be found.",
    });
  }

  return toDepositType(data);
}

async function softDeleteDepositType(
  client: GubernatorSupabaseClient,
  input: SoftDeleteDepositTypeInput,
): Promise<SoftDeleteDepositTypeResult> {
  const values = parseInput(softDeleteDepositTypeInputSchema, input);

  const { data, error } = await client
    .rpc("soft_delete_deposit_type", {
      p_deposit_type_id: values.depositTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new DepositTypeMutationError({
        code: "deposit_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be trashed.",
    });
  }

  return { depositTypeId: data.id, worldId: data.world_id };
}

async function restoreDepositType(
  client: GubernatorSupabaseClient,
  input: RestoreDepositTypeInput,
): Promise<RestoreDepositTypeResult> {
  const values = parseInput(restoreDepositTypeInputSchema, input);

  const { data, error } = await client
    .rpc("restore_deposit_type", {
      p_deposit_type_id: values.depositTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new DepositTypeMutationError({
        code: "deposit_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be restored.",
    });
  }

  return { depositTypeId: data.id, worldId: data.world_id };
}

async function hardDeleteDepositType(
  client: GubernatorSupabaseClient,
  input: HardDeleteDepositTypeInput,
): Promise<HardDeleteDepositTypeResult> {
  const values = parseInput(hardDeleteDepositTypeInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_deposit_type", {
      p_deposit_type_id: values.depositTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new DepositTypeMutationError({
        code: "deposit_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be permanently deleted.",
    });
  }

  return { depositTypeId: data.id, worldId: data.world_id };
}

function toWorkerInputsJson(
  entries: DepositTypeJobValues["workerInputsJson"],
): Json {
  return toSnakeCaseEntries(entries, {
    amountPerWorker: "amount_per_worker",
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
      new DepositTypeMutationError({
        code: "deposit_type_input_invalid",
        issues,
        message: "Deposit type input is invalid.",
      }),
  );
}

// deposit_type_jobs_unique is scoped per deposit type only (deposit_type_id,
// job_id), unlike the old world-wide-unique deposit_types_unique_active_job_id
// constraint — a job can now be linked to multiple deposit types. This only
// fires as a defensive backstop; the form/schema already reject duplicate
// jobIds within a single submission.
function isDuplicateJobInDepositTypeConflict(error: {
  code: string;
  message: string;
}): boolean {
  return (
    error.code === "23505" && error.message.includes("deposit_type_jobs_unique")
  );
}

function isDuplicateTierInDepositTypeConflict(error: {
  code: string;
  message: string;
}): boolean {
  return (
    error.code === "23505" &&
    error.message.includes("deposit_type_jobs_tier_number_unique")
  );
}
