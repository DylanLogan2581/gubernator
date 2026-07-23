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

import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";
import {
  transferManagedPopulationCountInputSchema,
  type TransferManagedPopulationCountInput,
} from "../schemas/transferManagedPopulationCountSchemas";

import type { TransferManagedPopulationCountResult } from "../types/managedPopulationInstanceTypes";
import type { z } from "zod";

type TransferManagedPopulationCountMutationErrorCode =
  | "transfer_managed_population_count_input_invalid"
  | "transfer_managed_population_count_not_authorized"
  | "transfer_managed_population_count_not_found"
  | "transfer_managed_population_count_values_invalid";

export type TransferManagedPopulationCountMutationIssue = MutationIssue;

export const {
  ErrorClass: TransferManagedPopulationCountMutationError,
  isError: isTransferManagedPopulationCountMutationError,
} = createMutationError<TransferManagedPopulationCountMutationErrorCode>(
  "TransferManagedPopulationCountMutationError",
);
export type TransferManagedPopulationCountMutationError = InstanceType<
  typeof TransferManagedPopulationCountMutationError
>;

type TransferManagedPopulationCountMutationOptions = UseMutationOptions<
  TransferManagedPopulationCountResult,
  Error,
  TransferManagedPopulationCountInput
>;

export function transferManagedPopulationCountMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): TransferManagedPopulationCountMutationOptions {
  return mutationOptions({
    mutationFn: (input: TransferManagedPopulationCountInput) =>
      transferManagedPopulationCount(client, input),
    mutationKey: [
      ...managedPopulationsQueryKeys.all,
      "transfer-managed-population-count",
    ],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: managedPopulationsQueryKeys.instancesBySettlement(
          result.settlementId,
        ),
      });
    },
  });
}

async function transferManagedPopulationCount(
  client: GubernatorSupabaseClient,
  input: TransferManagedPopulationCountInput,
): Promise<TransferManagedPopulationCountResult> {
  const values = parseInput(transferManagedPopulationCountInputSchema, input);

  const { data, error } = await client
    .rpc("transfer_managed_population_count", {
      p_from_instance_id: values.fromManagedPopulationInstanceId,
      p_to_instance_id: values.toManagedPopulationInstanceId,
      p_count: values.count,
    })
    .maybeSingle<{
      readonly from_instance_id: string;
      readonly settlement_id: string;
      readonly to_instance_id: string;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new TransferManagedPopulationCountMutationError({
        code: "transfer_managed_population_count_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new TransferManagedPopulationCountMutationError({
        code: "transfer_managed_population_count_not_found",
        message: "Managed population instance not found.",
      });
    }
    if (error.code === "P0001") {
      throw new TransferManagedPopulationCountMutationError({
        code: "transfer_managed_population_count_values_invalid",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new TransferManagedPopulationCountMutationError({
      code: "transfer_managed_population_count_not_found",
      message: "Managed population instance not found.",
    });
  }

  return {
    fromManagedPopulationInstanceId: data.from_instance_id,
    settlementId: data.settlement_id,
    toManagedPopulationInstanceId: data.to_instance_id,
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
      new TransferManagedPopulationCountMutationError({
        code: "transfer_managed_population_count_input_invalid",
        issues,
        message: "Transfer managed population count input is invalid.",
      }),
  );
}
