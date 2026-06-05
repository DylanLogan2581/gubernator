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
  setDepositInstanceResourceQuantitiesInputSchema,
  type SetDepositInstanceResourceQuantitiesInput,
} from "../schemas/setDepositInstanceResourceQuantitiesSchemas";

import type { SetDepositInstanceResourceQuantitiesResult } from "../types/depositInstanceTypes";
import type { z } from "zod";

type SetDepositInstanceResourceQuantitiesMutationErrorCode =
  | "set_resource_quantities_input_invalid"
  | "set_resource_quantities_not_authorized"
  | "set_resource_quantities_not_found"
  | "set_resource_quantities_out_of_range";

export type SetDepositInstanceResourceQuantitiesMutationIssue = MutationIssue;

export const {
  ErrorClass: SetDepositInstanceResourceQuantitiesMutationError,
  isError: isSetDepositInstanceResourceQuantitiesMutationError,
} = createMutationError<SetDepositInstanceResourceQuantitiesMutationErrorCode>(
  "SetDepositInstanceResourceQuantitiesMutationError",
);
export type SetDepositInstanceResourceQuantitiesMutationError = InstanceType<
  typeof SetDepositInstanceResourceQuantitiesMutationError
>;

type SetDepositInstanceResourceQuantitiesMutationOptions = UseMutationOptions<
  SetDepositInstanceResourceQuantitiesResult,
  Error,
  SetDepositInstanceResourceQuantitiesInput
>;

export function setDepositInstanceResourceQuantitiesMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetDepositInstanceResourceQuantitiesMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetDepositInstanceResourceQuantitiesInput) =>
      setDepositInstanceResourceQuantities(client, input),
    mutationKey: [
      ...depositsQueryKeys.all,
      "set-deposit-instance-resource-quantities",
    ],
    onSuccess: async (_result, input): Promise<void> => {
      const values =
        setDepositInstanceResourceQuantitiesInputSchema.parse(input);
      await queryClient.invalidateQueries({
        queryKey: depositsQueryKeys.instancesBySettlement(values.settlementId),
      });
    },
  });
}

async function setDepositInstanceResourceQuantities(
  client: GubernatorSupabaseClient,
  input: SetDepositInstanceResourceQuantitiesInput,
): Promise<SetDepositInstanceResourceQuantitiesResult> {
  const values = parseInput(
    setDepositInstanceResourceQuantitiesInputSchema,
    input,
  );

  const { data, error } = await client
    .rpc("set_deposit_instance_resource_quantities", {
      p_deposit_instance_resource_id: values.depositInstanceResourceId,
      p_initial_quantity: values.initialQuantity,
      p_remaining_quantity: values.remainingQuantity,
    })
    .maybeSingle<{
      readonly deposit_instance_resource_id: string;
      readonly deposit_instance_id: string;
      readonly settlement_id: string;
      readonly initial_quantity: number;
      readonly remaining_quantity: number;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new SetDepositInstanceResourceQuantitiesMutationError({
        code: "set_resource_quantities_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new SetDepositInstanceResourceQuantitiesMutationError({
        code: "set_resource_quantities_not_found",
        message: "Deposit instance resource not found.",
      });
    }
    if (error.code === "P0001") {
      throw new SetDepositInstanceResourceQuantitiesMutationError({
        code: "set_resource_quantities_out_of_range",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SetDepositInstanceResourceQuantitiesMutationError({
      code: "set_resource_quantities_not_found",
      message: "Deposit instance resource not found.",
    });
  }

  return {
    depositInstanceId: data.deposit_instance_id,
    depositInstanceResourceId: data.deposit_instance_resource_id,
    initialQuantity: data.initial_quantity,
    remainingQuantity: data.remaining_quantity,
    settlementId: data.settlement_id,
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
      new SetDepositInstanceResourceQuantitiesMutationError({
        code: "set_resource_quantities_input_invalid",
        issues,
        message: "Set deposit instance resource quantities input is invalid.",
      }),
  );
}
