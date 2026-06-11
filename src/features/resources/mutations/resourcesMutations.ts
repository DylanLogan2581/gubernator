import { normalizeSupabaseError } from "@/features/auth";
import { buildTrashLifecycleMutations } from "@/lib/buildTrashLifecycleMutations";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import type { GubernatorSupabaseClient } from "@/lib/supabase";
import type { Json } from "@/types/database";

import {
  RESOURCE_SELECT,
  toResource,
  type ResourceRow,
} from "../queries/resourceRow";
import { resourcesQueryKeys } from "../queries/resourcesQueryKeys";
import {
  cleanupSummarySchema,
  createResourceInputSchema,
  hardDeleteResourceInputSchema,
  restoreResourceInputSchema,
  softDeleteResourceInputSchema,
  updateResourceInputSchema,
  type CreateResourceInput,
  type HardDeleteResourceInput,
  type RestoreResourceInput,
  type SoftDeleteResourceInput,
  type UpdateResourceInput,
} from "../schemas/resourceSchemas";
import { validateResourceReferencesAgainstWorld } from "../utils/validateResourceReferences";

import type {
  HardDeleteResourceResult,
  Resource,
  ResourceCleanupSummary,
  RestoreResourceResult,
  SoftDeleteResourceResult,
} from "../types/resourceTypes";
import type { z } from "zod";

type ResourceMutationErrorCode =
  | "resource_input_invalid"
  | "resource_not_authorized"
  | "resource_not_found";

export type ResourceMutationIssue = MutationIssue;

export const {
  ErrorClass: ResourceMutationError,
  isError: isResourceMutationError,
} = createMutationError<ResourceMutationErrorCode>("ResourceMutationError");
export type ResourceMutationError = InstanceType<typeof ResourceMutationError>;

const resourceMutations = buildTrashLifecycleMutations<
  Resource,
  CreateResourceInput,
  UpdateResourceInput,
  SoftDeleteResourceInput,
  SoftDeleteResourceResult,
  RestoreResourceInput,
  RestoreResourceResult,
  HardDeleteResourceInput,
  HardDeleteResourceResult
>({
  actionNames: {
    create: "create-resource",
    hardDelete: "hard-delete-resource",
    restore: "restore-resource",
    softDelete: "soft-delete-resource",
    update: "update-resource",
  },
  getDetailId: {
    restore: (result) => result.resourceId,
    softDelete: (result) => result.resourceId,
  },
  mutationFns: {
    create: createResource,
    hardDelete: hardDeleteResource,
    restore: restoreResource,
    softDelete: softDeleteResource,
    update: updateResource,
  },
  queryKeys: {
    activeByWorld: resourcesQueryKeys.activeByWorld,
    all: resourcesQueryKeys.all,
    byWorld: resourcesQueryKeys.byWorld,
    detail: resourcesQueryKeys.detail,
  },
});

export const createResourceMutationOptions = resourceMutations.create;
export const updateResourceMutationOptions = resourceMutations.update;
export const softDeleteResourceMutationOptions = resourceMutations.softDelete;
export const restoreResourceMutationOptions = resourceMutations.restore;
export const hardDeleteResourceMutationOptions = resourceMutations.hardDelete;

async function createResource(
  client: GubernatorSupabaseClient,
  input: CreateResourceInput,
): Promise<Resource> {
  const values = parseInput(createResourceInputSchema, input);

  const refIssues = validateResourceReferencesAgainstWorld({});
  if (refIssues.length > 0) {
    throw new ResourceMutationError({
      code: "resource_input_invalid",
      message: "Resource references are invalid.",
    });
  }

  const { data, error } = await client
    .from("resources")
    .insert({
      base_stockpile_cap: values.baseStockpileCap ?? 0,
      decay_rate: values.decayRate ?? 0,
      name: values.name.trim(),
      slug: values.slug.trim(),
      world_id: values.worldId,
    })
    .select(RESOURCE_SELECT)
    .maybeSingle<ResourceRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ResourceMutationError({
      code: "resource_not_found",
      message: "Resource could not be created.",
    });
  }

  return toResource(data);
}

async function updateResource(
  client: GubernatorSupabaseClient,
  input: UpdateResourceInput,
): Promise<Resource> {
  const values = parseInput(updateResourceInputSchema, input);

  const refIssues = validateResourceReferencesAgainstWorld({});
  if (refIssues.length > 0) {
    throw new ResourceMutationError({
      code: "resource_input_invalid",
      message: "Resource references are invalid.",
    });
  }

  const updatePayload: {
    base_stockpile_cap?: number;
    decay_rate?: number;
    name?: string;
    slug?: string;
  } = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.slug !== undefined) {
    updatePayload.slug = values.slug.trim();
  }
  if (values.baseStockpileCap !== undefined) {
    updatePayload.base_stockpile_cap = values.baseStockpileCap;
  }
  if (values.decayRate !== undefined) {
    updatePayload.decay_rate = values.decayRate;
  }

  const { data, error } = await client
    .from("resources")
    .update(updatePayload)
    .eq("id", values.resourceId)
    .eq("world_id", values.worldId)
    .select(RESOURCE_SELECT)
    .maybeSingle<ResourceRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ResourceMutationError({
      code: "resource_not_found",
      message: "Resource could not be updated.",
    });
  }

  return toResource(data);
}

async function softDeleteResource(
  client: GubernatorSupabaseClient,
  input: SoftDeleteResourceInput,
): Promise<SoftDeleteResourceResult> {
  const values = parseInput(softDeleteResourceInputSchema, input);

  const { data, error } = await client
    .rpc("soft_delete_resource", {
      p_resource_id: values.resourceId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{
      readonly id: string;
      readonly last_cleanup_summary_json: Json;
      readonly world_id: string;
    }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ResourceMutationError({
        code: "resource_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ResourceMutationError({
      code: "resource_not_found",
      message: "Resource could not be soft-deleted.",
    });
  }

  return {
    cleanupSummary: parseCleanupSummary(data.last_cleanup_summary_json),
    resourceId: data.id,
    worldId: data.world_id,
  };
}

function parseCleanupSummary(json: Json): ResourceCleanupSummary {
  const result = cleanupSummarySchema.safeParse(json);
  if (!result.success) {
    return {
      buildingTierConstructionCostsCleaned: 0,
      buildingTierEffectsCleaned: 0,
      buildingTierUpkeepCostsCleaned: 0,
      depositTypesWorkerInputsCleaned: 0,
      jobDefinitionsInputsCleaned: 0,
      jobDefinitionsOutputsCleaned: 0,
      managedPopulationCullingOutputsCleaned: 0,
      managedPopulationMaintenanceCleaned: 0,
    };
  }
  const { data } = result;
  return {
    buildingTierConstructionCostsCleaned:
      data.building_tier_construction_costs_cleaned,
    buildingTierEffectsCleaned: data.building_tier_effects_cleaned,
    buildingTierUpkeepCostsCleaned: data.building_tier_upkeep_costs_cleaned,
    depositTypesWorkerInputsCleaned: data.deposit_types_worker_inputs_cleaned,
    jobDefinitionsInputsCleaned: data.job_definitions_inputs_cleaned,
    jobDefinitionsOutputsCleaned: data.job_definitions_outputs_cleaned,
    managedPopulationCullingOutputsCleaned:
      data.managed_population_culling_outputs_cleaned,
    managedPopulationMaintenanceCleaned:
      data.managed_population_maintenance_cleaned,
  };
}

async function restoreResource(
  client: GubernatorSupabaseClient,
  input: RestoreResourceInput,
): Promise<RestoreResourceResult> {
  const values = parseInput(restoreResourceInputSchema, input);

  const { data, error } = await client
    .rpc("restore_resource", {
      p_resource_id: values.resourceId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ResourceMutationError({
        code: "resource_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ResourceMutationError({
      code: "resource_not_found",
      message: "Resource could not be restored.",
    });
  }

  return { resourceId: data.id, worldId: data.world_id };
}

async function hardDeleteResource(
  client: GubernatorSupabaseClient,
  input: HardDeleteResourceInput,
): Promise<HardDeleteResourceResult> {
  const values = parseInput(hardDeleteResourceInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_resource", {
      p_resource_id: values.resourceId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ResourceMutationError({
        code: "resource_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ResourceMutationError({
      code: "resource_not_found",
      message: "Resource could not be permanently deleted.",
    });
  }

  return { resourceId: data.id, worldId: data.world_id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ResourceMutationError({
        code: "resource_input_invalid",
        issues,
        message: "Resource input is invalid.",
      }),
  );
}
