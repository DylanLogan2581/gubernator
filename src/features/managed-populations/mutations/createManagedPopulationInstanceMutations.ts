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
  createManagedPopulationInstanceInputSchema,
  type CreateManagedPopulationInstanceInput,
} from "../schemas/createManagedPopulationInstanceSchemas";

import type { CreateManagedPopulationInstanceResult } from "../types/managedPopulationInstanceTypes";
import type { z } from "zod";

type CreateManagedPopulationInstanceMutationErrorCode =
  | "managed_population_instance_input_invalid"
  | "managed_population_instance_not_authorized"
  | "managed_population_instance_not_found"
  | "managed_population_instance_type_not_found"
  | "managed_population_instance_type_trashed"
  | "managed_population_instance_values_invalid";

export type CreateManagedPopulationInstanceMutationIssue = MutationIssue;

export const {
  ErrorClass: CreateManagedPopulationInstanceMutationError,
  isError: isCreateManagedPopulationInstanceMutationError,
} = createMutationError<CreateManagedPopulationInstanceMutationErrorCode>(
  "CreateManagedPopulationInstanceMutationError",
);
export type CreateManagedPopulationInstanceMutationError = InstanceType<
  typeof CreateManagedPopulationInstanceMutationError
>;

type CreateManagedPopulationInstanceMutationOptions = UseMutationOptions<
  CreateManagedPopulationInstanceResult,
  Error,
  CreateManagedPopulationInstanceInput
>;

export function createManagedPopulationInstanceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateManagedPopulationInstanceMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateManagedPopulationInstanceInput) =>
      createManagedPopulationInstance(client, input),
    mutationKey: [
      ...managedPopulationsQueryKeys.all,
      "create-managed-population-instance",
    ],
    onSuccess: async (_result, variables): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: managedPopulationsQueryKeys.instancesBySettlement(
          variables.settlementId,
        ),
      });
    },
  });
}

async function createManagedPopulationInstance(
  client: GubernatorSupabaseClient,
  input: CreateManagedPopulationInstanceInput,
): Promise<CreateManagedPopulationInstanceResult> {
  const values = parseInput(createManagedPopulationInstanceInputSchema, input);

  const { data, error } = await client
    .rpc("create_managed_population_instance", {
      p_initial_count: values.initialCount,
      p_initial_cull_quantity: values.initialCullQuantity,
      p_name: values.name.trim(),
      p_settlement_id: values.settlementId,
      p_type_id: values.typeId,
    })
    .maybeSingle<{ readonly id: string; readonly settlement_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new CreateManagedPopulationInstanceMutationError({
        code: "managed_population_instance_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      if (error.message.includes("trashed")) {
        throw new CreateManagedPopulationInstanceMutationError({
          code: "managed_population_instance_type_trashed",
          message: "Managed population type is trashed.",
        });
      }
      throw new CreateManagedPopulationInstanceMutationError({
        code: "managed_population_instance_values_invalid",
        message: error.message,
      });
    }
    if (error.code === "P0002") {
      throw new CreateManagedPopulationInstanceMutationError({
        code: "managed_population_instance_type_not_found",
        message: "Settlement or managed population type not found.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CreateManagedPopulationInstanceMutationError({
      code: "managed_population_instance_not_found",
      message: "Managed population instance could not be created.",
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
      new CreateManagedPopulationInstanceMutationError({
        code: "managed_population_instance_input_invalid",
        issues,
        message: "Managed population instance input is invalid.",
      }),
  );
}
