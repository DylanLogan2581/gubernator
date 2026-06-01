import { normalizeSupabaseError } from "@/features/auth";
import { buildTrashLifecycleMutations } from "@/lib/buildTrashLifecycleMutations";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import { toSnakeCaseEntries } from "@/lib/toSnakeCaseEntries";
import type { Json } from "@/types/database";

import {
  MANAGED_POPULATION_TYPE_SELECT,
  toManagedPopulationType,
  type ManagedPopulationTypeRow,
} from "../queries/managedPopulationRow";
import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";
import {
  createManagedPopulationTypeInputSchema,
  hardDeleteManagedPopulationTypeInputSchema,
  restoreManagedPopulationTypeInputSchema,
  softDeleteManagedPopulationTypeInputSchema,
  updateManagedPopulationTypeInputSchema,
  type CreateManagedPopulationTypeInput,
  type HardDeleteManagedPopulationTypeInput,
  type RestoreManagedPopulationTypeInput,
  type SoftDeleteManagedPopulationTypeInput,
  type UpdateManagedPopulationTypeInput,
} from "../schemas/managedPopulationSchemas";

import type {
  HardDeleteManagedPopulationTypeResult,
  ManagedPopulationType,
  PopulationResourceEntry,
  RestoreManagedPopulationTypeResult,
  SoftDeleteManagedPopulationTypeResult,
} from "../types/managedPopulationTypes";
import type { z } from "zod";

type ManagedPopulationTypeMutationErrorCode =
  | "managed_population_type_culling_job_already_linked"
  | "managed_population_type_husbandry_job_already_linked"
  | "managed_population_type_input_invalid"
  | "managed_population_type_not_authorized"
  | "managed_population_type_not_found";

// Explicit typed payloads prevent RejectExcessProperties conflicts in Supabase's strict overloads.
type ManagedPopulationTypeInsertPayload = {
  culling_job_id: string;
  culling_outputs_json?: Json;
  growth_rate: number;
  husbandry_job_id: string;
  husbandry_workers_per_n_animals: number;
  maintenance_rules_json?: Json;
  name: string;
  slug: string;
  world_id: string;
};

type ManagedPopulationTypeUpdatePayload = {
  culling_job_id?: string;
  culling_outputs_json?: Json;
  growth_rate?: number;
  husbandry_job_id?: string;
  husbandry_workers_per_n_animals?: number;
  maintenance_rules_json?: Json;
  name?: string;
  slug?: string;
};

export type ManagedPopulationTypeMutationIssue = MutationIssue;

export const {
  ErrorClass: ManagedPopulationTypeMutationError,
  isError: isManagedPopulationTypeMutationError,
} = createMutationError<ManagedPopulationTypeMutationErrorCode>(
  "ManagedPopulationTypeMutationError",
);
export type ManagedPopulationTypeMutationError = InstanceType<
  typeof ManagedPopulationTypeMutationError
>;

const managedPopulationTypeMutations = buildTrashLifecycleMutations<
  ManagedPopulationType,
  CreateManagedPopulationTypeInput,
  UpdateManagedPopulationTypeInput,
  SoftDeleteManagedPopulationTypeInput,
  SoftDeleteManagedPopulationTypeResult,
  RestoreManagedPopulationTypeInput,
  RestoreManagedPopulationTypeResult,
  HardDeleteManagedPopulationTypeInput,
  HardDeleteManagedPopulationTypeResult
>({
  actionNames: {
    create: "create-managed-population-type",
    hardDelete: "hard-delete-managed-population-type",
    restore: "restore-managed-population-type",
    softDelete: "soft-delete-managed-population-type",
    update: "update-managed-population-type",
  },
  getDetailId: {
    restore: (result) => result.managedPopulationTypeId,
    softDelete: (result) => result.managedPopulationTypeId,
  },
  mutationFns: {
    create: createManagedPopulationType,
    hardDelete: hardDeleteManagedPopulationType,
    restore: restoreManagedPopulationType,
    softDelete: softDeleteManagedPopulationType,
    update: updateManagedPopulationType,
  },
  queryKeys: {
    activeByWorld: managedPopulationsQueryKeys.activeByWorld,
    all: managedPopulationsQueryKeys.all,
    byWorld: managedPopulationsQueryKeys.byWorld,
    detail: managedPopulationsQueryKeys.detail,
  },
});

export const createManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.create;
export const updateManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.update;
export const softDeleteManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.softDelete;
export const restoreManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.restore;
export const hardDeleteManagedPopulationTypeMutationOptions =
  managedPopulationTypeMutations.hardDelete;

async function createManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: CreateManagedPopulationTypeInput,
): Promise<ManagedPopulationType> {
  const values = parseInput(createManagedPopulationTypeInputSchema, input);

  const insertPayload: ManagedPopulationTypeInsertPayload = {
    culling_job_id: values.cullingJobId,
    growth_rate: values.growthRate,
    husbandry_job_id: values.husbandryJobId,
    husbandry_workers_per_n_animals: values.husbandryWorkersPerNAnimals,
    name: values.name.trim(),
    slug: values.slug.trim(),
    world_id: values.worldId,
  };

  if (values.maintenanceRulesJson !== undefined) {
    insertPayload.maintenance_rules_json = toPopulationResourceJson(
      values.maintenanceRulesJson,
    );
  }

  if (values.cullingOutputsJson !== undefined) {
    insertPayload.culling_outputs_json = toPopulationResourceJson(
      values.cullingOutputsJson,
    );
  }

  const { data, error } = await client
    .from("managed_population_types")
    .insert(insertPayload)
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .maybeSingle<ManagedPopulationTypeRow>();

  if (error !== null) {
    if (isActiveHusbandryJobIdConflict(error)) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_husbandry_job_already_linked",
        message:
          "This husbandry job is already linked to another active managed population type.",
      });
    }
    if (isActiveCullingJobIdConflict(error)) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_culling_job_already_linked",
        message:
          "This culling job is already linked to another active managed population type.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be created.",
    });
  }

  return toManagedPopulationType(data);
}

async function updateManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: UpdateManagedPopulationTypeInput,
): Promise<ManagedPopulationType> {
  const values = parseInput(updateManagedPopulationTypeInputSchema, input);

  const updatePayload: ManagedPopulationTypeUpdatePayload = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.slug !== undefined) {
    updatePayload.slug = values.slug.trim();
  }
  if (values.husbandryJobId !== undefined) {
    updatePayload.husbandry_job_id = values.husbandryJobId;
  }
  if (values.cullingJobId !== undefined) {
    updatePayload.culling_job_id = values.cullingJobId;
  }
  if (values.husbandryWorkersPerNAnimals !== undefined) {
    updatePayload.husbandry_workers_per_n_animals =
      values.husbandryWorkersPerNAnimals;
  }
  if (values.growthRate !== undefined) {
    updatePayload.growth_rate = values.growthRate;
  }
  if (values.maintenanceRulesJson !== undefined) {
    updatePayload.maintenance_rules_json = toPopulationResourceJson(
      values.maintenanceRulesJson,
    );
  }
  if (values.cullingOutputsJson !== undefined) {
    updatePayload.culling_outputs_json = toPopulationResourceJson(
      values.cullingOutputsJson,
    );
  }

  const { data, error } = await client
    .from("managed_population_types")
    .update(updatePayload)
    .eq("id", values.managedPopulationTypeId)
    .eq("world_id", values.worldId)
    .select(MANAGED_POPULATION_TYPE_SELECT)
    .maybeSingle<ManagedPopulationTypeRow>();

  if (error !== null) {
    if (isActiveHusbandryJobIdConflict(error)) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_husbandry_job_already_linked",
        message:
          "This husbandry job is already linked to another active managed population type.",
      });
    }
    if (isActiveCullingJobIdConflict(error)) {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_culling_job_already_linked",
        message:
          "This culling job is already linked to another active managed population type.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be updated.",
    });
  }

  return toManagedPopulationType(data);
}

async function softDeleteManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: SoftDeleteManagedPopulationTypeInput,
): Promise<SoftDeleteManagedPopulationTypeResult> {
  const values = parseInput(softDeleteManagedPopulationTypeInputSchema, input);

  const { data, error } = await client
    .rpc("soft_delete_managed_population_type", {
      p_mpt_id: values.managedPopulationTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be trashed.",
    });
  }

  return { managedPopulationTypeId: data.id, worldId: data.world_id };
}

async function restoreManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: RestoreManagedPopulationTypeInput,
): Promise<RestoreManagedPopulationTypeResult> {
  const values = parseInput(restoreManagedPopulationTypeInputSchema, input);

  const { data, error } = await client
    .rpc("restore_managed_population_type", {
      p_mpt_id: values.managedPopulationTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be restored.",
    });
  }

  return { managedPopulationTypeId: data.id, worldId: data.world_id };
}

async function hardDeleteManagedPopulationType(
  client: GubernatorSupabaseClient,
  input: HardDeleteManagedPopulationTypeInput,
): Promise<HardDeleteManagedPopulationTypeResult> {
  const values = parseInput(hardDeleteManagedPopulationTypeInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_managed_population_type", {
      p_mpt_id: values.managedPopulationTypeId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManagedPopulationTypeMutationError({
        code: "managed_population_type_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManagedPopulationTypeMutationError({
      code: "managed_population_type_not_found",
      message: "Managed population type could not be permanently deleted.",
    });
  }

  return { managedPopulationTypeId: data.id, worldId: data.world_id };
}

function toPopulationResourceJson(
  entries: readonly PopulationResourceEntry[],
): Json {
  return toSnakeCaseEntries(entries, {
    amountPerNAnimals: "amount_per_n_animals",
    resourceId: "resource_id",
  });
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ManagedPopulationTypeMutationError({
        code: "managed_population_type_input_invalid",
        issues,
        message: "Managed population type input is invalid.",
      }),
  );
}

function isActiveHusbandryJobIdConflict(error: {
  code: string;
  message: string;
}): boolean {
  return (
    error.code === "23505" &&
    error.message.includes(
      "managed_population_types_unique_active_husbandry_job_id",
    )
  );
}

function isActiveCullingJobIdConflict(error: {
  code: string;
  message: string;
}): boolean {
  return (
    error.code === "23505" &&
    error.message.includes(
      "managed_population_types_unique_active_culling_job_id",
    )
  );
}
