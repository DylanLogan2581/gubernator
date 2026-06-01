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
  setDepositInstanceMaxWorkersInputSchema,
  type SetDepositInstanceMaxWorkersInput,
} from "../schemas/setDepositInstanceMaxWorkersSchemas";

import type { SetDepositInstanceMaxWorkersResult } from "../types/depositInstanceTypes";
import type { z } from "zod";

type SetDepositInstanceMaxWorkersMutationErrorCode =
  | "set_max_workers_input_invalid"
  | "set_max_workers_not_authorized"
  | "set_max_workers_not_found"
  | "set_max_workers_strategy_required";

export type SetDepositInstanceMaxWorkersMutationIssue = MutationIssue;

export const {
  ErrorClass: SetDepositInstanceMaxWorkersMutationError,
  isError: isSetDepositInstanceMaxWorkersMutationError,
} = createMutationError<SetDepositInstanceMaxWorkersMutationErrorCode>(
  "SetDepositInstanceMaxWorkersMutationError",
);
export type SetDepositInstanceMaxWorkersMutationError = InstanceType<
  typeof SetDepositInstanceMaxWorkersMutationError
>;

type SetDepositInstanceMaxWorkersMutationOptions = UseMutationOptions<
  SetDepositInstanceMaxWorkersResult,
  Error,
  SetDepositInstanceMaxWorkersInput
>;

export function setDepositInstanceMaxWorkersMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetDepositInstanceMaxWorkersMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetDepositInstanceMaxWorkersInput) =>
      setDepositInstanceMaxWorkers(client, input),
    mutationKey: [...depositsQueryKeys.all, "set-deposit-instance-max-workers"],
    onSuccess: async (_result, input): Promise<void> => {
      const values = setDepositInstanceMaxWorkersInputSchema.parse(input);
      await queryClient.invalidateQueries({
        queryKey: depositsQueryKeys.instancesBySettlement(values.settlementId),
      });
    },
  });
}

async function setDepositInstanceMaxWorkers(
  client: GubernatorSupabaseClient,
  input: SetDepositInstanceMaxWorkersInput,
): Promise<SetDepositInstanceMaxWorkersResult> {
  const values = parseInput(setDepositInstanceMaxWorkersInputSchema, input);

  const { data, error } = await client
    .rpc("set_deposit_instance_max_workers", {
      p_deposit_instance_id: values.depositInstanceId,
      p_max_workers: values.maxWorkers as number,
      p_removal_strategy: values.removalStrategy as string,
    })
    .maybeSingle<{
      max_workers: number | null;
      unassigned_citizen_ids: string[];
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new SetDepositInstanceMaxWorkersMutationError({
        code: "set_max_workers_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new SetDepositInstanceMaxWorkersMutationError({
        code: "set_max_workers_not_found",
        message: "Deposit instance not found.",
      });
    }
    if (error.code === "P0001") {
      throw new SetDepositInstanceMaxWorkersMutationError({
        code: "set_max_workers_strategy_required",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SetDepositInstanceMaxWorkersMutationError({
      code: "set_max_workers_not_found",
      message: "Deposit instance not found.",
    });
  }

  return {
    maxWorkers: data.max_workers,
    unassignedCitizenIds: data.unassigned_citizen_ids,
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
      new SetDepositInstanceMaxWorkersMutationError({
        code: "set_max_workers_input_invalid",
        issues,
        message: "Set deposit instance max workers input is invalid.",
      }),
  );
}
