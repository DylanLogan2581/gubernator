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
  hardDeleteDepositInstanceInputSchema,
  type HardDeleteDepositInstanceInput,
} from "../schemas/hardDeleteDepositInstanceSchemas";

import type { HardDeleteDepositInstanceResult } from "../types/depositInstanceTypes";
import type { z } from "zod";

type HardDeleteDepositInstanceMutationErrorCode =
  | "hard_delete_deposit_instance_input_invalid"
  | "hard_delete_deposit_instance_not_authorized"
  | "hard_delete_deposit_instance_not_found"
  | "hard_delete_deposit_instance_not_removed";

export type HardDeleteDepositInstanceMutationIssue = MutationIssue;

export const {
  ErrorClass: HardDeleteDepositInstanceMutationError,
  isError: isHardDeleteDepositInstanceMutationError,
} = createMutationError<HardDeleteDepositInstanceMutationErrorCode>(
  "HardDeleteDepositInstanceMutationError",
);
export type HardDeleteDepositInstanceMutationError = InstanceType<
  typeof HardDeleteDepositInstanceMutationError
>;

type HardDeleteDepositInstanceMutationOptions = UseMutationOptions<
  HardDeleteDepositInstanceResult,
  Error,
  HardDeleteDepositInstanceInput
>;

export function hardDeleteDepositInstanceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): HardDeleteDepositInstanceMutationOptions {
  return mutationOptions({
    mutationFn: (input: HardDeleteDepositInstanceInput) =>
      hardDeleteDepositInstance(client, input),
    mutationKey: [...depositsQueryKeys.all, "hard-delete-deposit-instance"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: depositsQueryKeys.instancesBySettlement(result.settlementId),
      });
    },
  });
}

async function hardDeleteDepositInstance(
  client: GubernatorSupabaseClient,
  input: HardDeleteDepositInstanceInput,
): Promise<HardDeleteDepositInstanceResult> {
  const values = parseInput(hardDeleteDepositInstanceInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_deposit_instance", {
      p_deposit_instance_id: values.depositInstanceId,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new HardDeleteDepositInstanceMutationError({
        code: "hard_delete_deposit_instance_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new HardDeleteDepositInstanceMutationError({
        code: "hard_delete_deposit_instance_not_found",
        message: "Deposit instance not found.",
      });
    }
    if (error.code === "P0001") {
      throw new HardDeleteDepositInstanceMutationError({
        code: "hard_delete_deposit_instance_not_removed",
        message:
          "Deposit instance must be removed before permanently deleting.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new HardDeleteDepositInstanceMutationError({
      code: "hard_delete_deposit_instance_not_found",
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
      new HardDeleteDepositInstanceMutationError({
        code: "hard_delete_deposit_instance_input_invalid",
        issues,
        message: "Hard delete deposit instance input is invalid.",
      }),
  );
}
