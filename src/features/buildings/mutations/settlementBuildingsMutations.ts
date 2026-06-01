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

import { buildingsQueryKeys } from "../queries/buildingsQueryKeys";
import {
  manualDeconstructBuildingInputSchema,
  type ManualDeconstructBuildingInput,
} from "../schemas/manualDeconstructBuildingSchemas";

import type { ManualDeconstructBuildingResult } from "../types/settlementBuildingTypes";
import type { z } from "zod";

type ManualDeconstructBuildingMutationErrorCode =
  | "manual_deconstruct_building_input_invalid"
  | "manual_deconstruct_building_not_authorized"
  | "manual_deconstruct_building_not_found"
  | "manual_deconstruct_building_wrong_state";

export type ManualDeconstructBuildingMutationIssue = MutationIssue;

export const {
  ErrorClass: ManualDeconstructBuildingMutationError,
  isError: isManualDeconstructBuildingMutationError,
} = createMutationError<ManualDeconstructBuildingMutationErrorCode>(
  "ManualDeconstructBuildingMutationError",
);
export type ManualDeconstructBuildingMutationError = InstanceType<
  typeof ManualDeconstructBuildingMutationError
>;

type ManualDeconstructBuildingMutationOptions = UseMutationOptions<
  ManualDeconstructBuildingResult,
  Error,
  ManualDeconstructBuildingInput
>;

export function manualDeconstructBuildingMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): ManualDeconstructBuildingMutationOptions {
  return mutationOptions({
    mutationFn: (input: ManualDeconstructBuildingInput) =>
      manualDeconstructBuilding(client, input),
    mutationKey: [...buildingsQueryKeys.all, "manual-deconstruct-building"],
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            buildingsQueryKeys.settlementBuildingsBySettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.settlementPopulationCap(settlementId),
        }),
      ]);
    },
  });
}

async function manualDeconstructBuilding(
  client: GubernatorSupabaseClient,
  input: ManualDeconstructBuildingInput,
): Promise<ManualDeconstructBuildingResult> {
  const values = parseInput(manualDeconstructBuildingInputSchema, input);

  const { data, error } = await client
    .rpc("manual_deconstruct_settlement_building", {
      p_settlement_building_id: values.settlementBuildingId,
    })
    .maybeSingle<{ readonly settlement_building_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_not_found",
        message: "Settlement building not found.",
      });
    }
    if (error.code === "P0001") {
      throw new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_wrong_state",
        message: "Building cannot be deconstructed in its current state.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManualDeconstructBuildingMutationError({
      code: "manual_deconstruct_building_not_found",
      message: "Settlement building not found.",
    });
  }

  return { settlementBuildingId: data.settlement_building_id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_input_invalid",
        issues,
        message: "Manual deconstruct building input is invalid.",
      }),
  );
}
