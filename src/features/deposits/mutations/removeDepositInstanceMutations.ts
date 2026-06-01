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
  removeDepositInstanceInputSchema,
  type RemoveDepositInstanceInput,
} from "../schemas/removeDepositInstanceSchemas";

import type { RemoveDepositInstanceResult } from "../types/depositInstanceTypes";
import type { z } from "zod";

type RemoveDepositInstanceMutationErrorCode =
  | "remove_deposit_instance_already_removed"
  | "remove_deposit_instance_blocked"
  | "remove_deposit_instance_input_invalid"
  | "remove_deposit_instance_not_authorized"
  | "remove_deposit_instance_not_found";

export type RemoveDepositInstanceMutationIssue = MutationIssue;

export const {
  ErrorClass: RemoveDepositInstanceMutationError,
  isError: isRemoveDepositInstanceMutationError,
} = createMutationError<RemoveDepositInstanceMutationErrorCode>(
  "RemoveDepositInstanceMutationError",
);
export type RemoveDepositInstanceMutationError = InstanceType<
  typeof RemoveDepositInstanceMutationError
>;

type RemoveDepositInstanceMutationOptions = UseMutationOptions<
  RemoveDepositInstanceResult,
  Error,
  RemoveDepositInstanceInput
>;

export function removeDepositInstanceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RemoveDepositInstanceMutationOptions {
  return mutationOptions({
    mutationFn: (input: RemoveDepositInstanceInput) =>
      removeDepositInstance(client, input),
    mutationKey: [...depositsQueryKeys.all, "remove-deposit-instance"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: depositsQueryKeys.instancesBySettlement(result.settlementId),
      });
    },
  });
}

async function removeDepositInstance(
  client: GubernatorSupabaseClient,
  input: RemoveDepositInstanceInput,
): Promise<RemoveDepositInstanceResult> {
  const values = parseInput(removeDepositInstanceInputSchema, input);

  const { data, error } = await client
    .rpc("remove_deposit_instance", {
      p_deposit_instance_id: values.depositInstanceId,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new RemoveDepositInstanceMutationError({
        code: "remove_deposit_instance_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new RemoveDepositInstanceMutationError({
        code: "remove_deposit_instance_not_found",
        message: "Deposit instance not found.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("already removed")) {
        throw new RemoveDepositInstanceMutationError({
          code: "remove_deposit_instance_already_removed",
          message: "Deposit instance is already removed.",
        });
      }
      throw new RemoveDepositInstanceMutationError({
        code: "remove_deposit_instance_blocked",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new RemoveDepositInstanceMutationError({
      code: "remove_deposit_instance_not_found",
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
      new RemoveDepositInstanceMutationError({
        code: "remove_deposit_instance_input_invalid",
        issues,
        message: "Remove deposit instance input is invalid.",
      }),
  );
}
