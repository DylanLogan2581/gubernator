import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import type { TierCostEntry } from "@/features/buildings";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { toSnakeCaseEntries } from "@/lib/toSnakeCaseEntries";
import type { Json } from "@/types/database";

import {
  UNIT_TYPE_SELECT,
  toUnitType,
  type UnitTypeRow,
} from "../queries/unitTypeRow";
import { unitTypesQueryKeys } from "../queries/unitTypesQueryKeys";
import {
  createUnitTypeInputSchema,
  deleteUnitTypeInputSchema,
  updateUnitTypeInputSchema,
  type CreateUnitTypeInput,
  type DeleteUnitTypeInput,
  type UpdateUnitTypeInput,
} from "../schemas/unitTypeSchemas";

import type { DeleteUnitTypeResult, UnitType } from "../types/unitTypeTypes";
import type { z } from "zod";

type UnitTypeMutationErrorCode =
  | "unit_type_forbidden"
  | "unit_type_in_use"
  | "unit_type_input_invalid"
  | "unit_type_invalid_reference"
  | "unit_type_name_taken"
  | "unit_type_not_found";

export type UnitTypeMutationIssue = MutationIssue;

export const {
  ErrorClass: UnitTypeMutationError,
  isError: isUnitTypeMutationError,
} = createMutationError<UnitTypeMutationErrorCode>("UnitTypeMutationError");
export type UnitTypeMutationError = InstanceType<typeof UnitTypeMutationError>;

// Explicit typed insert/update payloads prevent RejectExcessProperties
// conflicts in Supabase's strict overloads.
type UnitTypeInsertPayload = {
  description?: string | null;
  desertion_rate: number;
  name: string;
  recruitment_costs_json?: Json;
  required_building_blueprint_id?: string | null;
  required_building_tier_number?: number | null;
  required_education_level_id?: string | null;
  soldiers_per_unit: number;
  upkeep_costs_json?: Json;
  world_id: string;
};

type UnitTypeUpdatePayload = {
  description?: string | null;
  desertion_rate?: number;
  name?: string;
  recruitment_costs_json?: Json;
  required_building_blueprint_id?: string | null;
  required_building_tier_number?: number | null;
  required_education_level_id?: string | null;
  soldiers_per_unit?: number;
  upkeep_costs_json?: Json;
};

type CreateUnitTypeMutationOptions = UseMutationOptions<
  UnitType,
  AuthUiError | UnitTypeMutationError,
  CreateUnitTypeInput
>;
type UpdateUnitTypeMutationOptions = UseMutationOptions<
  UnitType,
  AuthUiError | UnitTypeMutationError,
  UpdateUnitTypeInput
>;
type DeleteUnitTypeMutationOptions = UseMutationOptions<
  DeleteUnitTypeResult,
  AuthUiError | UnitTypeMutationError,
  DeleteUnitTypeInput
>;

export function createUnitTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateUnitTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateUnitTypeInput) => createUnitType(client, input),
    mutationKey: [...unitTypesQueryKeys.all, "create-unit-type"],
    onSuccess: async (unitType): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: unitTypesQueryKeys.byWorld(unitType.worldId),
      });
    },
  });
}

export function updateUnitTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateUnitTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateUnitTypeInput) => updateUnitType(client, input),
    mutationKey: [...unitTypesQueryKeys.all, "update-unit-type"],
    onSuccess: async (unitType): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: unitTypesQueryKeys.byWorld(unitType.worldId),
      });
    },
  });
}

export function deleteUnitTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteUnitTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteUnitTypeInput) => deleteUnitType(client, input),
    mutationKey: [...unitTypesQueryKeys.all, "delete-unit-type"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: unitTypesQueryKeys.byWorld(result.worldId),
      });
    },
  });
}

async function createUnitType(
  client: GubernatorSupabaseClient,
  input: CreateUnitTypeInput,
): Promise<UnitType> {
  const values = parseInput(createUnitTypeInputSchema, input);

  const insertPayload: UnitTypeInsertPayload = {
    description: values.description ?? null,
    desertion_rate: values.desertionRate,
    name: values.name.trim(),
    recruitment_costs_json: toCostJson(values.recruitmentCostsJson ?? []),
    required_building_blueprint_id: values.requiredBuildingBlueprintId ?? null,
    required_building_tier_number: values.requiredBuildingTierNumber ?? null,
    required_education_level_id: values.requiredEducationLevelId ?? null,
    soldiers_per_unit: values.soldiersPerUnit,
    upkeep_costs_json: toCostJson(values.upkeepCostsJson ?? []),
    world_id: values.worldId,
  };

  const { data, error } = await client
    .from("unit_types")
    .insert(insertPayload)
    .select(UNIT_TYPE_SELECT)
    .maybeSingle<UnitTypeRow>();

  if (error !== null) {
    throw translateUnitTypeError(error, "write");
  }

  if (data === null) {
    throw new UnitTypeMutationError({
      code: "unit_type_not_found",
      message: "Unit type could not be created.",
    });
  }

  return toUnitType(data);
}

async function updateUnitType(
  client: GubernatorSupabaseClient,
  input: UpdateUnitTypeInput,
): Promise<UnitType> {
  const values = parseInput(updateUnitTypeInputSchema, input);

  const updatePayload: UnitTypeUpdatePayload = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.description !== undefined) {
    updatePayload.description = values.description;
  }
  if (values.soldiersPerUnit !== undefined) {
    updatePayload.soldiers_per_unit = values.soldiersPerUnit;
  }
  if (values.desertionRate !== undefined) {
    updatePayload.desertion_rate = values.desertionRate;
  }
  if (values.requiredEducationLevelId !== undefined) {
    updatePayload.required_education_level_id = values.requiredEducationLevelId;
  }
  if (values.requiredBuildingBlueprintId !== undefined) {
    updatePayload.required_building_blueprint_id =
      values.requiredBuildingBlueprintId;
  }
  if (values.requiredBuildingTierNumber !== undefined) {
    updatePayload.required_building_tier_number =
      values.requiredBuildingTierNumber;
  }
  if (values.recruitmentCostsJson !== undefined) {
    updatePayload.recruitment_costs_json = toCostJson(
      values.recruitmentCostsJson,
    );
  }
  if (values.upkeepCostsJson !== undefined) {
    updatePayload.upkeep_costs_json = toCostJson(values.upkeepCostsJson);
  }

  const { data, error } = await client
    .from("unit_types")
    .update(updatePayload)
    .eq("id", values.unitTypeId)
    .eq("world_id", values.worldId)
    .select(UNIT_TYPE_SELECT)
    .maybeSingle<UnitTypeRow>();

  if (error !== null) {
    throw translateUnitTypeError(error, "write");
  }

  if (data === null) {
    throw new UnitTypeMutationError({
      code: "unit_type_not_found",
      message: "Unit type could not be updated.",
    });
  }

  return toUnitType(data);
}

async function deleteUnitType(
  client: GubernatorSupabaseClient,
  input: DeleteUnitTypeInput,
): Promise<DeleteUnitTypeResult> {
  const values = parseInput(deleteUnitTypeInputSchema, input);

  const { data, error } = await client
    .from("unit_types")
    .delete()
    .eq("id", values.unitTypeId)
    .eq("world_id", values.worldId)
    .select("id,world_id")
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    throw translateUnitTypeError(error, "delete");
  }

  if (data === null) {
    throw new UnitTypeMutationError({
      code: "unit_type_not_found",
      message: "Unit type could not be deleted.",
    });
  }

  return { unitTypeId: data.id, worldId: data.world_id };
}

function toCostJson(entries: readonly TierCostEntry[]): Json {
  return toSnakeCaseEntries(entries, {
    amount: "amount",
    resourceId: "resource_id",
  });
}

function translateUnitTypeError(
  error: { readonly code?: string | null; readonly message: string },
  operation: "delete" | "write",
): Error {
  if (error.code === "23505") {
    return new UnitTypeMutationError({
      code: "unit_type_name_taken",
      message: "A unit type with this name already exists.",
    });
  }
  if (error.code === "23503") {
    return operation === "delete"
      ? new UnitTypeMutationError({
          code: "unit_type_in_use",
          message: "This unit type is still in use and cannot be deleted.",
        })
      : new UnitTypeMutationError({
          code: "unit_type_invalid_reference",
          message: "The required education level or building tier is invalid.",
        });
  }
  if (error.code === "23514") {
    return new UnitTypeMutationError({
      code: "unit_type_input_invalid",
      message: "Unit type input is invalid.",
    });
  }
  if (error.code === "42501") {
    return new UnitTypeMutationError({
      code: "unit_type_forbidden",
      message: "You do not have permission to manage unit types.",
    });
  }
  return normalizeSupabaseError(error);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new UnitTypeMutationError({
        code: "unit_type_input_invalid",
        issues,
        message: "Unit type input is invalid.",
      }),
  );
}
