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

  const { data, error } = await client
    .from("resources")
    .insert({
      base_stockpile_cap: values.baseStockpileCap ?? 0,
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

  const updatePayload: {
    base_stockpile_cap?: number;
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
  const obj =
    json !== null && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, Json>)
      : {};
  return {
    buildingTierConstructionCostsCleaned: toInt(
      obj["building_tier_construction_costs_cleaned"],
    ),
    buildingTierEffectsCleaned: toInt(obj["building_tier_effects_cleaned"]),
    buildingTierUpkeepCostsCleaned: toInt(
      obj["building_tier_upkeep_costs_cleaned"],
    ),
    depositTypesWorkerInputsCleaned: toInt(
      obj["deposit_types_worker_inputs_cleaned"],
    ),
    jobDefinitionsInputsCleaned: toInt(obj["job_definitions_inputs_cleaned"]),
    jobDefinitionsOutputsCleaned: toInt(obj["job_definitions_outputs_cleaned"]),
    managedPopulationCullingOutputsCleaned: toInt(
      obj["managed_population_culling_outputs_cleaned"],
    ),
    managedPopulationMaintenanceCleaned: toInt(
      obj["managed_population_maintenance_cleaned"],
    ),
  };
}

function toInt(value: Json | undefined): number {
  return typeof value === "number" ? value : 0;
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
