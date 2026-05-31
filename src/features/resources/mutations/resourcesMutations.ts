import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Json } from "@/types/database";

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

type CreateResourceMutationOptions = UseMutationOptions<
  Resource,
  AuthUiError | ResourceMutationError,
  CreateResourceInput
>;
type UpdateResourceMutationOptions = UseMutationOptions<
  Resource,
  AuthUiError | ResourceMutationError,
  UpdateResourceInput
>;
type SoftDeleteResourceMutationOptions = UseMutationOptions<
  SoftDeleteResourceResult,
  AuthUiError | ResourceMutationError,
  SoftDeleteResourceInput
>;
type RestoreResourceMutationOptions = UseMutationOptions<
  RestoreResourceResult,
  AuthUiError | ResourceMutationError,
  RestoreResourceInput
>;
type HardDeleteResourceMutationOptions = UseMutationOptions<
  HardDeleteResourceResult,
  AuthUiError | ResourceMutationError,
  HardDeleteResourceInput
>;

type ResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_deleted: boolean;
  readonly is_system_resource: boolean;
  readonly last_cleanup_summary_json: Json;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

const RESOURCE_SELECT =
  "id,world_id,name,slug,base_stockpile_cap,is_system_resource,is_deleted,last_cleanup_summary_json,created_at,updated_at";

export type ResourceMutationIssue = MutationIssue;

export const {
  ErrorClass: ResourceMutationError,
  isError: isResourceMutationError,
} = createMutationError<ResourceMutationErrorCode>("ResourceMutationError");
export type ResourceMutationError = InstanceType<typeof ResourceMutationError>;

export function createResourceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateResourceMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateResourceInput) => createResource(client, input),
    mutationKey: [...resourcesQueryKeys.all, "create-resource"],
    onSuccess: async (resource): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.byWorld(resource.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.activeByWorld(resource.worldId),
        }),
      ]);
    },
  });
}

export function updateResourceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateResourceMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateResourceInput) => updateResource(client, input),
    mutationKey: [...resourcesQueryKeys.all, "update-resource"],
    onSuccess: async (resource): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.byWorld(resource.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.activeByWorld(resource.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.detail(resource.id),
        }),
      ]);
    },
  });
}

export function softDeleteResourceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SoftDeleteResourceMutationOptions {
  return mutationOptions({
    mutationFn: (input: SoftDeleteResourceInput) =>
      softDeleteResource(client, input),
    mutationKey: [...resourcesQueryKeys.all, "soft-delete-resource"],
    onSuccess: async (result): Promise<void> => {
      queryClient.removeQueries({
        queryKey: resourcesQueryKeys.detail(result.resourceId),
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.activeByWorld(result.worldId),
        }),
      ]);
    },
  });
}

export function restoreResourceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RestoreResourceMutationOptions {
  return mutationOptions({
    mutationFn: (input: RestoreResourceInput) => restoreResource(client, input),
    mutationKey: [...resourcesQueryKeys.all, "restore-resource"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.activeByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.detail(result.resourceId),
        }),
      ]);
    },
  });
}

export function hardDeleteResourceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): HardDeleteResourceMutationOptions {
  return mutationOptions({
    mutationFn: (input: HardDeleteResourceInput) =>
      hardDeleteResource(client, input),
    mutationKey: [...resourcesQueryKeys.all, "hard-delete-resource"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.byWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.activeByWorld(result.worldId),
        }),
      ]);
    },
  });
}

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

function toResource(row: ResourceRow): Resource {
  return {
    baseStockpileCap: row.base_stockpile_cap,
    createdAt: row.created_at,
    id: row.id,
    isDeleted: row.is_deleted,
    isSystemResource: row.is_system_resource,
    lastCleanupSummaryJson: row.last_cleanup_summary_json,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
