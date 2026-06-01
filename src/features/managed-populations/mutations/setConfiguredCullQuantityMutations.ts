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
  setConfiguredCullQuantityInputSchema,
  type SetConfiguredCullQuantityInput,
} from "../schemas/setConfiguredCullQuantitySchemas";

import type { SetConfiguredCullQuantityResult } from "../types/managedPopulationInstanceTypes";
import type { z } from "zod";

type SetConfiguredCullQuantityMutationErrorCode =
  | "set_configured_cull_quantity_input_invalid"
  | "set_configured_cull_quantity_not_authorized"
  | "set_configured_cull_quantity_not_found"
  | "set_configured_cull_quantity_values_invalid";

export type SetConfiguredCullQuantityMutationIssue = MutationIssue;

export const {
  ErrorClass: SetConfiguredCullQuantityMutationError,
  isError: isSetConfiguredCullQuantityMutationError,
} = createMutationError<SetConfiguredCullQuantityMutationErrorCode>(
  "SetConfiguredCullQuantityMutationError",
);
export type SetConfiguredCullQuantityMutationError = InstanceType<
  typeof SetConfiguredCullQuantityMutationError
>;

type SetConfiguredCullQuantityMutationOptions = UseMutationOptions<
  SetConfiguredCullQuantityResult,
  Error,
  SetConfiguredCullQuantityInput
>;

export function setConfiguredCullQuantityMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetConfiguredCullQuantityMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetConfiguredCullQuantityInput) =>
      setConfiguredCullQuantity(client, input),
    mutationKey: [
      ...managedPopulationsQueryKeys.all,
      "set-configured-cull-quantity",
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

async function setConfiguredCullQuantity(
  client: GubernatorSupabaseClient,
  input: SetConfiguredCullQuantityInput,
): Promise<SetConfiguredCullQuantityResult> {
  const values = parseInput(setConfiguredCullQuantityInputSchema, input);

  const { data, error } = await client
    .rpc("set_configured_cull_quantity", {
      p_instance_id: values.managedPopulationInstanceId,
      p_quantity: values.quantity,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new SetConfiguredCullQuantityMutationError({
        code: "set_configured_cull_quantity_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new SetConfiguredCullQuantityMutationError({
        code: "set_configured_cull_quantity_not_found",
        message: "Managed population instance not found.",
      });
    }
    if (error.code === "P0001") {
      throw new SetConfiguredCullQuantityMutationError({
        code: "set_configured_cull_quantity_values_invalid",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SetConfiguredCullQuantityMutationError({
      code: "set_configured_cull_quantity_not_found",
      message: "Managed population instance not found.",
    });
  }

  return {
    managedPopulationInstanceId: data.id,
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
      new SetConfiguredCullQuantityMutationError({
        code: "set_configured_cull_quantity_input_invalid",
        issues,
        message: "Set configured cull quantity input is invalid.",
      }),
  );
}
