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

import { depositsQueryKeys } from "../queries/depositsQueryKeys";
import {
  createDepositTypeInputSchema,
  setDepositTypeActiveInputSchema,
  updateDepositTypeInputSchema,
  type CreateDepositTypeInput,
  type SetDepositTypeActiveInput,
  type UpdateDepositTypeInput,
} from "../schemas/depositSchemas";

import type {
  DepositType,
  SetDepositTypeActiveResult,
  WorkerInputEntry,
} from "../types/depositTypes";
import type { z } from "zod";

type DepositTypeMutationErrorCode =
  | "deposit_type_input_invalid"
  | "deposit_type_not_found";

type CreateDepositTypeMutationOptions = UseMutationOptions<
  DepositType,
  AuthUiError | DepositTypeMutationError,
  CreateDepositTypeInput
>;
type UpdateDepositTypeMutationOptions = UseMutationOptions<
  DepositType,
  AuthUiError | DepositTypeMutationError,
  UpdateDepositTypeInput
>;
type SetDepositTypeActiveMutationOptions = UseMutationOptions<
  SetDepositTypeActiveResult,
  AuthUiError | DepositTypeMutationError,
  SetDepositTypeActiveInput
>;

// Explicit typed payloads prevent RejectExcessProperties conflicts in Supabase's strict overloads.
type DepositTypeInsertPayload = {
  job_id: string;
  name: string;
  output_units_per_worker: number;
  slug: string;
  worker_inputs_json?: Json;
  world_id: string;
};

type DepositTypeUpdatePayload = {
  job_id?: string;
  name?: string;
  output_units_per_worker?: number;
  slug?: string;
  worker_inputs_json?: Json;
};

type WorkerInputEntryRow = {
  readonly amount_per_worker: number;
  readonly resource_id: string;
};

type DepositTypeRow = {
  readonly created_at: string;
  readonly id: string;
  readonly is_active: boolean;
  readonly job_id: string;
  readonly name: string;
  readonly output_units_per_worker: number;
  readonly slug: string;
  readonly updated_at: string;
  readonly worker_inputs_json: readonly WorkerInputEntryRow[];
  readonly world_id: string;
};

const DEPOSIT_TYPE_SELECT =
  "id,world_id,name,slug,job_id,output_units_per_worker,worker_inputs_json,is_active,created_at,updated_at";

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

export function createDepositTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateDepositTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateDepositTypeInput) =>
      createDepositType(client, input),
    mutationKey: [...depositsQueryKeys.all, "create-deposit-type"],
    onSuccess: async (depositType): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.byWorld(depositType.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.activeByWorld(depositType.worldId),
        }),
      ]);
    },
  });
}

export function updateDepositTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateDepositTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateDepositTypeInput) =>
      updateDepositType(client, input),
    mutationKey: [...depositsQueryKeys.all, "update-deposit-type"],
    onSuccess: async (depositType): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.byWorld(depositType.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.activeByWorld(depositType.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.detail(depositType.id),
        }),
      ]);
    },
  });
}

export function setDepositTypeActiveMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetDepositTypeActiveMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetDepositTypeActiveInput) =>
      setDepositTypeActive(client, input),
    mutationKey: [...depositsQueryKeys.all, "set-deposit-type-active"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.activeByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: depositsQueryKeys.detail(result.depositTypeId),
        }),
      ]);
    },
  });
}

async function createDepositType(
  client: GubernatorSupabaseClient,
  input: CreateDepositTypeInput,
): Promise<DepositType> {
  const values = parseInput(createDepositTypeInputSchema, input);

  const insertPayload: DepositTypeInsertPayload = {
    job_id: values.jobId,
    name: values.name.trim(),
    output_units_per_worker: values.outputUnitsPerWorker,
    slug: values.slug.trim(),
    world_id: values.worldId,
  };

  if (values.workerInputsJson !== undefined) {
    insertPayload.worker_inputs_json = toWorkerInputsJson(
      values.workerInputsJson,
    );
  }

  const { data, error } = await client
    .from("deposit_types")
    .insert(insertPayload)
    .select(DEPOSIT_TYPE_SELECT)
    .maybeSingle<DepositTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be created.",
    });
  }

  return toDepositType(data);
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
  if (values.jobId !== undefined) {
    updatePayload.job_id = values.jobId;
  }
  if (values.outputUnitsPerWorker !== undefined) {
    updatePayload.output_units_per_worker = values.outputUnitsPerWorker;
  }
  if (values.workerInputsJson !== undefined) {
    updatePayload.worker_inputs_json = toWorkerInputsJson(
      values.workerInputsJson,
    );
  }

  const { data, error } = await client
    .from("deposit_types")
    .update(updatePayload)
    .eq("id", values.depositTypeId)
    .eq("world_id", values.worldId)
    .select(DEPOSIT_TYPE_SELECT)
    .maybeSingle<DepositTypeRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be updated.",
    });
  }

  return toDepositType(data);
}

async function setDepositTypeActive(
  client: GubernatorSupabaseClient,
  input: SetDepositTypeActiveInput,
): Promise<SetDepositTypeActiveResult> {
  const values = parseInput(setDepositTypeActiveInputSchema, input);

  const { data, error } = await client
    .from("deposit_types")
    .update({ is_active: values.isActive })
    .eq("id", values.depositTypeId)
    .eq("world_id", values.worldId)
    .select("id,world_id,is_active")
    .maybeSingle<{
      readonly id: string;
      readonly is_active: boolean;
      readonly world_id: string;
    }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new DepositTypeMutationError({
      code: "deposit_type_not_found",
      message: "Deposit type could not be updated.",
    });
  }

  return {
    depositTypeId: data.id,
    isActive: data.is_active,
    worldId: data.world_id,
  };
}

function toWorkerInputsJson(entries: readonly WorkerInputEntry[]): Json {
  return entries.map(
    (e): Record<string, Json> => ({
      amount_per_worker: e.amountPerWorker,
      resource_id: e.resourceId,
    }),
  );
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
    id: row.id,
    isActive: row.is_active,
    jobId: row.job_id,
    name: row.name,
    outputUnitsPerWorker: row.output_units_per_worker,
    slug: row.slug,
    updatedAt: row.updated_at,
    workerInputsJson: row.worker_inputs_json.map(toWorkerInputEntry),
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
      new DepositTypeMutationError({
        code: "deposit_type_input_invalid",
        issues,
        message: "Deposit type input is invalid.",
      }),
  );
}
