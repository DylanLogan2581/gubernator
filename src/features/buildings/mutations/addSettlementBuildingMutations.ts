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
  addSettlementBuildingInputSchema,
  type AddSettlementBuildingInput,
} from "../schemas/addSettlementBuildingSchemas";

import type { AddSettlementBuildingResult } from "../types/settlementBuildingTypes";
import type { z } from "zod";

type AddSettlementBuildingMutationErrorCode =
  | "add_settlement_building_blueprint_trashed"
  | "add_settlement_building_input_invalid"
  | "add_settlement_building_not_authorized"
  | "add_settlement_building_not_found";

export type AddSettlementBuildingMutationIssue = MutationIssue;

export const {
  ErrorClass: AddSettlementBuildingMutationError,
  isError: isAddSettlementBuildingMutationError,
} = createMutationError<AddSettlementBuildingMutationErrorCode>(
  "AddSettlementBuildingMutationError",
);
export type AddSettlementBuildingMutationError = InstanceType<
  typeof AddSettlementBuildingMutationError
>;

type AddSettlementBuildingMutationOptions = UseMutationOptions<
  AddSettlementBuildingResult,
  Error,
  AddSettlementBuildingInput
>;

export function addSettlementBuildingMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): AddSettlementBuildingMutationOptions {
  return mutationOptions({
    mutationFn: (input: AddSettlementBuildingInput) =>
      addSettlementBuilding(client, input),
    mutationKey: [...buildingsQueryKeys.all, "add-settlement-building"],
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

async function addSettlementBuilding(
  client: GubernatorSupabaseClient,
  input: AddSettlementBuildingInput,
): Promise<AddSettlementBuildingResult> {
  const values = parseInput(addSettlementBuildingInputSchema, input);

  const { data, error } = await client
    .rpc("add_settlement_building_as_admin", {
      p_blueprint_id: values.blueprintId,
      p_name: values.name,
      p_settlement_id: values.settlementId,
      p_tier_id: values.tierId,
    })
    .maybeSingle<{ readonly id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new AddSettlementBuildingMutationError({
        code: "add_settlement_building_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new AddSettlementBuildingMutationError({
        code: "add_settlement_building_not_found",
        message: "Settlement, blueprint, or tier not found.",
      });
    }
    if (error.code === "P0001") {
      throw new AddSettlementBuildingMutationError({
        code: "add_settlement_building_blueprint_trashed",
        message: "Blueprint is trashed.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new AddSettlementBuildingMutationError({
      code: "add_settlement_building_not_found",
      message: "Building could not be created.",
    });
  }

  return { settlementBuildingId: data.id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new AddSettlementBuildingMutationError({
        code: "add_settlement_building_input_invalid",
        issues,
        message: "Add settlement building input is invalid.",
      }),
  );
}
