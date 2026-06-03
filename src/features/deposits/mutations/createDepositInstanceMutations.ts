import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { toSnakeCaseEntries } from "@/lib/toSnakeCaseEntries";
import type { Json } from "@/types/database";

import { depositsQueryKeys } from "../queries/depositsQueryKeys";
import {
  createDepositInstanceInputSchema,
  type CreateDepositInstanceInput,
} from "../schemas/createDepositInstanceSchemas";

import type { CreateDepositInstanceResult } from "../types/depositInstanceTypes";
import type { z } from "zod";

type CreateDepositInstanceMutationErrorCode =
  | "deposit_instance_deposit_type_not_found"
  | "deposit_instance_deposit_type_trashed"
  | "deposit_instance_input_invalid"
  | "deposit_instance_not_authorized"
  | "deposit_instance_not_found"
  | "deposit_instance_resource_invalid";

export type CreateDepositInstanceMutationIssue = MutationIssue;

export const {
  ErrorClass: CreateDepositInstanceMutationError,
  isError: isCreateDepositInstanceMutationError,
} = createMutationError<CreateDepositInstanceMutationErrorCode>(
  "CreateDepositInstanceMutationError",
);
export type CreateDepositInstanceMutationError = InstanceType<
  typeof CreateDepositInstanceMutationError
>;

type CreateDepositInstanceMutationOptions = UseMutationOptions<
  CreateDepositInstanceResult,
  Error,
  CreateDepositInstanceInput
>;

export function createDepositInstanceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateDepositInstanceMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateDepositInstanceInput) =>
      createDepositInstance(client, input),
    mutationKey: [...depositsQueryKeys.all, "create-deposit-instance"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: depositsQueryKeys.instancesBySettlement(result.settlementId),
      });
    },
  });
}

async function createDepositInstance(
  client: GubernatorSupabaseClient,
  input: CreateDepositInstanceInput,
): Promise<CreateDepositInstanceResult> {
  const values = parseInput(createDepositInstanceInputSchema, input);

  const { data, error } = await client
    .rpc("create_deposit_instance", {
      p_deposit_type_id: values.depositTypeId,
      p_max_workers: (values.maxWorkers ?? null) as number,
      p_name: values.name.trim(),
      p_resources: toResourcesJson(values.resources),
      p_settlement_id: values.settlementId,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new CreateDepositInstanceMutationError({
        code: "deposit_instance_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("trashed")) {
        throw new CreateDepositInstanceMutationError({
          code: "deposit_instance_deposit_type_trashed",
          message: "Deposit type is trashed.",
        });
      }
      throw new CreateDepositInstanceMutationError({
        code: "deposit_instance_resource_invalid",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new CreateDepositInstanceMutationError({
        code: "deposit_instance_deposit_type_not_found",
        message: "Settlement or deposit type not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CreateDepositInstanceMutationError({
      code: "deposit_instance_not_found",
      message: "Deposit instance could not be created.",
    });
  }

  return { depositInstanceId: data.id, settlementId: data.settlement_id };
}

function toResourcesJson(
  entries: readonly { resourceId: string; initialQuantity: number }[],
): Json {
  return toSnakeCaseEntries(entries, {
    initialQuantity: "initial_quantity",
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
      new CreateDepositInstanceMutationError({
        code: "deposit_instance_input_invalid",
        issues,
        message: "Deposit instance input is invalid.",
      }),
  );
}
