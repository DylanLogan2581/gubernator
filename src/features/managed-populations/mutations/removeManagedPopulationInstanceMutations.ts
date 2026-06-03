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
  removeManagedPopulationInstanceInputSchema,
  type RemoveManagedPopulationInstanceInput,
} from "../schemas/removeManagedPopulationInstanceSchemas";

import type { RemoveManagedPopulationInstanceResult } from "../types/managedPopulationInstanceTypes";
import type { z } from "zod";

type RemoveManagedPopulationInstanceMutationErrorCode =
  | "remove_managed_population_instance_already_extinct"
  | "remove_managed_population_instance_blocked"
  | "remove_managed_population_instance_input_invalid"
  | "remove_managed_population_instance_not_authorized"
  | "remove_managed_population_instance_not_found";

export type RemoveManagedPopulationInstanceMutationIssue = MutationIssue;

export const {
  ErrorClass: RemoveManagedPopulationInstanceMutationError,
  isError: isRemoveManagedPopulationInstanceMutationError,
} = createMutationError<RemoveManagedPopulationInstanceMutationErrorCode>(
  "RemoveManagedPopulationInstanceMutationError",
);
export type RemoveManagedPopulationInstanceMutationError = InstanceType<
  typeof RemoveManagedPopulationInstanceMutationError
>;

type RemoveManagedPopulationInstanceMutationOptions = UseMutationOptions<
  RemoveManagedPopulationInstanceResult,
  Error,
  RemoveManagedPopulationInstanceInput
>;

export function removeManagedPopulationInstanceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RemoveManagedPopulationInstanceMutationOptions {
  return mutationOptions({
    mutationFn: (input: RemoveManagedPopulationInstanceInput) =>
      removeManagedPopulationInstance(client, input),
    mutationKey: [
      ...managedPopulationsQueryKeys.all,
      "remove-managed-population-instance",
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

async function removeManagedPopulationInstance(
  client: GubernatorSupabaseClient,
  input: RemoveManagedPopulationInstanceInput,
): Promise<RemoveManagedPopulationInstanceResult> {
  const values = parseInput(removeManagedPopulationInstanceInputSchema, input);

  const { data, error } = await client
    .rpc("remove_managed_population_instance", {
      p_instance_id: values.managedPopulationInstanceId,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new RemoveManagedPopulationInstanceMutationError({
        code: "remove_managed_population_instance_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new RemoveManagedPopulationInstanceMutationError({
        code: "remove_managed_population_instance_not_found",
        message: "Managed population instance not found.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("already extinct")) {
        throw new RemoveManagedPopulationInstanceMutationError({
          code: "remove_managed_population_instance_already_extinct",
          message: "Managed population instance is already extinct.",
        });
      }
      throw new RemoveManagedPopulationInstanceMutationError({
        code: "remove_managed_population_instance_blocked",
        message: error.message,
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new RemoveManagedPopulationInstanceMutationError({
      code: "remove_managed_population_instance_not_found",
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
      new RemoveManagedPopulationInstanceMutationError({
        code: "remove_managed_population_instance_input_invalid",
        issues,
        message: "Remove managed population instance input is invalid.",
      }),
  );
}
