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

import { depositsQueryKeys } from "../queries/depositsQueryKeys";
import {
  restoreDepositInstanceInputSchema,
  type RestoreDepositInstanceInput,
} from "../schemas/restoreDepositInstanceSchemas";

import type { RestoreDepositInstanceResult } from "../types/depositInstanceTypes";
import type { z } from "zod";

type RestoreDepositInstanceMutationErrorCode =
  | "restore_deposit_instance_input_invalid"
  | "restore_deposit_instance_not_authorized"
  | "restore_deposit_instance_not_found"
  | "restore_deposit_instance_not_removed";

export type RestoreDepositInstanceMutationIssue = MutationIssue;

export const {
  ErrorClass: RestoreDepositInstanceMutationError,
  isError: isRestoreDepositInstanceMutationError,
} = createMutationError<RestoreDepositInstanceMutationErrorCode>(
  "RestoreDepositInstanceMutationError",
);
export type RestoreDepositInstanceMutationError = InstanceType<
  typeof RestoreDepositInstanceMutationError
>;

type RestoreDepositInstanceMutationOptions = UseMutationOptions<
  RestoreDepositInstanceResult,
  Error,
  RestoreDepositInstanceInput
>;

export function restoreDepositInstanceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RestoreDepositInstanceMutationOptions {
  return mutationOptions({
    mutationFn: (input: RestoreDepositInstanceInput) =>
      restoreDepositInstance(client, input),
    mutationKey: [...depositsQueryKeys.all, "restore-deposit-instance"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: depositsQueryKeys.instancesBySettlement(result.settlementId),
      });
    },
  });
}

async function restoreDepositInstance(
  client: GubernatorSupabaseClient,
  input: RestoreDepositInstanceInput,
): Promise<RestoreDepositInstanceResult> {
  const values = parseInput(restoreDepositInstanceInputSchema, input);

  const { data, error } = await client
    .rpc("restore_deposit_instance", {
      p_deposit_instance_id: values.depositInstanceId,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new RestoreDepositInstanceMutationError({
        code: "restore_deposit_instance_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new RestoreDepositInstanceMutationError({
        code: "restore_deposit_instance_not_found",
        message: "Deposit instance not found.",
      });
    }
    if (error.code === "P0001") {
      throw new RestoreDepositInstanceMutationError({
        code: "restore_deposit_instance_not_removed",
        message: "Deposit instance is not removed.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new RestoreDepositInstanceMutationError({
      code: "restore_deposit_instance_not_found",
      message: "Deposit instance not found.",
    });
  }

  return { depositInstanceId: data.id, settlementId: data.settlement_id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new RestoreDepositInstanceMutationError({
        code: "restore_deposit_instance_input_invalid",
        issues,
        message: "Restore deposit instance input is invalid.",
      }),
  );
}
