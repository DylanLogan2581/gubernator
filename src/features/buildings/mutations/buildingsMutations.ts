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

import { buildingsQueryKeys } from "../queries/buildingsQueryKeys";
import {
  createBlueprintInputSchema,
  createTierInputSchema,
  deleteTierInputSchema,
  hardDeleteBlueprintInputSchema,
  restoreBlueprintInputSchema,
  softDeleteBlueprintInputSchema,
  updateBlueprintInputSchema,
  updateTierInputSchema,
  type CreateBlueprintInput,
  type CreateTierInput,
  type DeleteTierInput,
  type HardDeleteBlueprintInput,
  type RestoreBlueprintInput,
  type SoftDeleteBlueprintInput,
  type UpdateBlueprintInput,
  type UpdateTierInput,
} from "../schemas/buildingSchemas";

import type {
  BuildingBlueprint,
  BuildingBlueprintTier,
  DeleteTierResult,
  HardDeleteBlueprintResult,
  RestoreBlueprintResult,
  SoftDeleteBlueprintResult,
  TierCostEntry,
  TierEffect,
} from "../types/buildingTypes";
import type { z } from "zod";

type BuildingMutationErrorCode =
  | "building_blueprint_not_authorized"
  | "building_blueprint_not_found"
  | "building_input_invalid"
  | "building_tier_not_found";

export type BuildingMutationIssue = MutationIssue;

export const {
  ErrorClass: BuildingMutationError,
  isError: isBuildingMutationError,
} = createMutationError<BuildingMutationErrorCode>("BuildingMutationError");
export type BuildingMutationError = InstanceType<typeof BuildingMutationError>;

type CreateBlueprintMutationOptions = UseMutationOptions<
  BuildingBlueprint,
  AuthUiError | BuildingMutationError,
  CreateBlueprintInput
>;
type UpdateBlueprintMutationOptions = UseMutationOptions<
  BuildingBlueprint,
  AuthUiError | BuildingMutationError,
  UpdateBlueprintInput
>;
type SoftDeleteBlueprintMutationOptions = UseMutationOptions<
  SoftDeleteBlueprintResult,
  AuthUiError | BuildingMutationError,
  SoftDeleteBlueprintInput
>;
type RestoreBlueprintMutationOptions = UseMutationOptions<
  RestoreBlueprintResult,
  AuthUiError | BuildingMutationError,
  RestoreBlueprintInput
>;
type HardDeleteBlueprintMutationOptions = UseMutationOptions<
  HardDeleteBlueprintResult,
  AuthUiError | BuildingMutationError,
  HardDeleteBlueprintInput
>;
type CreateTierMutationOptions = UseMutationOptions<
  BuildingBlueprintTier,
  AuthUiError | BuildingMutationError,
  CreateTierInput
>;
type UpdateTierMutationOptions = UseMutationOptions<
  BuildingBlueprintTier,
  AuthUiError | BuildingMutationError,
  UpdateTierInput
>;
type DeleteTierMutationOptions = UseMutationOptions<
  DeleteTierResult,
  AuthUiError | BuildingMutationError,
  DeleteTierInput
>;

type BlueprintInsertPayload = {
  description?: string;
  grace_period_turns?: number;
  max_instances_per_settlement?: number;
  name: string;
  slug: string;
  world_id: string;
};

type BlueprintUpdatePayload = {
  description?: string | null;
  grace_period_turns?: number;
  max_instances_per_settlement?: number | null;
  name?: string;
  slug?: string;
};

type TierInsertPayload = {
  building_blueprint_id: string;
  construction_costs_json?: Json;
  effects_json?: Json;
  tier_number: number;
  upkeep_costs_json?: Json;
  worker_turns_required?: number;
};

type TierUpdatePayload = {
  construction_costs_json?: Json;
  effects_json?: Json;
  upkeep_costs_json?: Json;
  worker_turns_required?: number;
};

type BlueprintRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly grace_period_turns: number;
  readonly id: string;
  readonly is_active: boolean;
  readonly max_instances_per_settlement: number | null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TierCostEntryRow = {
  readonly amount: number;
  readonly resource_id: string;
};

type TierEffectRow =
  | {
      readonly amount: number;
      readonly job_id: string;
      readonly type: "job_capacity_increase";
    }
  | {
      readonly amount: number;
      readonly resource_id: string;
      readonly type: "passive_resource_production";
    }
  | {
      readonly amount: number;
      readonly resource_id: string;
      readonly type: "resource_storage_increase";
    }
  | {
      readonly amount: number;
      readonly type: "population_cap_increase";
    };

type TierRow = {
  readonly building_blueprint_id: string;
  readonly construction_costs_json: readonly TierCostEntryRow[];
  readonly created_at: string;
  readonly effects_json: readonly TierEffectRow[];
  readonly id: string;
  readonly tier_number: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: readonly TierCostEntryRow[];
  readonly worker_turns_required: number;
};

const BLUEPRINT_SELECT =
  "id,world_id,name,slug,description,grace_period_turns,max_instances_per_settlement,is_active,created_at,updated_at";

const TIER_SELECT =
  "id,building_blueprint_id,tier_number,worker_turns_required,construction_costs_json,upkeep_costs_json,effects_json,created_at,updated_at";

export function createBlueprintMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateBlueprintMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateBlueprintInput) => createBlueprint(client, input),
    mutationKey: [...buildingsQueryKeys.all, "create-blueprint"],
    onSuccess: async (blueprint): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: buildingsQueryKeys.blueprintsByWorld(blueprint.worldId),
      });
    },
  });
}

export function updateBlueprintMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateBlueprintMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateBlueprintInput) => updateBlueprint(client, input),
    mutationKey: [...buildingsQueryKeys.all, "update-blueprint"],
    onSuccess: async (blueprint): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.blueprintsByWorld(blueprint.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.blueprintById(blueprint.id),
        }),
      ]);
    },
  });
}

export function softDeleteBlueprintMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SoftDeleteBlueprintMutationOptions {
  return mutationOptions({
    mutationFn: (input: SoftDeleteBlueprintInput) =>
      softDeleteBlueprint(client, input),
    mutationKey: [...buildingsQueryKeys.all, "soft-delete-blueprint"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.blueprintsByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.blueprintById(result.blueprintId),
        }),
      ]);
    },
  });
}

export function restoreBlueprintMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RestoreBlueprintMutationOptions {
  return mutationOptions({
    mutationFn: (input: RestoreBlueprintInput) =>
      restoreBlueprint(client, input),
    mutationKey: [...buildingsQueryKeys.all, "restore-blueprint"],
    onSuccess: async (result): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.blueprintsByWorld(result.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.blueprintById(result.blueprintId),
        }),
      ]);
    },
  });
}

export function hardDeleteBlueprintMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): HardDeleteBlueprintMutationOptions {
  return mutationOptions({
    mutationFn: (input: HardDeleteBlueprintInput) =>
      hardDeleteBlueprint(client, input),
    mutationKey: [...buildingsQueryKeys.all, "hard-delete-blueprint"],
    onSuccess: async (result): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: buildingsQueryKeys.blueprintsByWorld(result.worldId),
      });
    },
  });
}

export function createTierMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateTierMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateTierInput) => createTier(client, input),
    mutationKey: [...buildingsQueryKeys.all, "create-tier"],
    onSuccess: async (tier): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: buildingsQueryKeys.tiersByBlueprint(tier.buildingBlueprintId),
      });
    },
  });
}

export function updateTierMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateTierMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateTierInput) => updateTier(client, input),
    mutationKey: [...buildingsQueryKeys.all, "update-tier"],
    onSuccess: async (tier): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.tiersByBlueprint(
            tier.buildingBlueprintId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.tierById(tier.id),
        }),
      ]);
    },
  });
}

export function deleteTierMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteTierMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteTierInput) => deleteTier(client, input),
    mutationKey: [...buildingsQueryKeys.all, "delete-tier"],
    onSuccess: (result): void => {
      queryClient.removeQueries({
        queryKey: buildingsQueryKeys.tierById(result.tierId),
      });
      void queryClient.invalidateQueries({
        queryKey: buildingsQueryKeys.tiersByBlueprint(result.blueprintId),
      });
    },
  });
}

async function createBlueprint(
  client: GubernatorSupabaseClient,
  input: CreateBlueprintInput,
): Promise<BuildingBlueprint> {
  const values = parseInput(createBlueprintInputSchema, input);

  const insertPayload: BlueprintInsertPayload = {
    name: values.name.trim(),
    slug: values.slug.trim(),
    world_id: values.worldId,
  };

  if (values.description !== undefined) {
    insertPayload.description = values.description;
  }
  if (values.gracePeriodTurns !== undefined) {
    insertPayload.grace_period_turns = values.gracePeriodTurns;
  }
  if (values.maxInstancesPerSettlement !== undefined) {
    insertPayload.max_instances_per_settlement =
      values.maxInstancesPerSettlement;
  }

  const { data, error } = await client
    .from("building_blueprints")
    .insert(insertPayload)
    .select(BLUEPRINT_SELECT)
    .maybeSingle<BlueprintRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_blueprint_not_found",
      message: "Blueprint could not be created.",
    });
  }

  return toBlueprint(data);
}

async function updateBlueprint(
  client: GubernatorSupabaseClient,
  input: UpdateBlueprintInput,
): Promise<BuildingBlueprint> {
  const values = parseInput(updateBlueprintInputSchema, input);

  const updatePayload: BlueprintUpdatePayload = {};

  if (values.name !== undefined) {
    updatePayload.name = values.name.trim();
  }
  if (values.slug !== undefined) {
    updatePayload.slug = values.slug.trim();
  }
  if (values.description !== undefined) {
    updatePayload.description =
      values.description.length > 0 ? values.description : null;
  }
  if (values.gracePeriodTurns !== undefined) {
    updatePayload.grace_period_turns = values.gracePeriodTurns;
  }
  if (values.maxInstancesPerSettlement !== undefined) {
    updatePayload.max_instances_per_settlement =
      values.maxInstancesPerSettlement;
  }

  const { data, error } = await client
    .from("building_blueprints")
    .update(updatePayload)
    .eq("id", values.blueprintId)
    .eq("world_id", values.worldId)
    .select(BLUEPRINT_SELECT)
    .maybeSingle<BlueprintRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_blueprint_not_found",
      message: "Blueprint could not be updated.",
    });
  }

  return toBlueprint(data);
}

async function softDeleteBlueprint(
  client: GubernatorSupabaseClient,
  input: SoftDeleteBlueprintInput,
): Promise<SoftDeleteBlueprintResult> {
  const values = parseInput(softDeleteBlueprintInputSchema, input);

  const { data, error } = await client
    .rpc("soft_delete_building_blueprint", {
      p_blueprint_id: values.blueprintId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new BuildingMutationError({
        code: "building_blueprint_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_blueprint_not_found",
      message: "Blueprint could not be trashed.",
    });
  }

  return { blueprintId: data.id, worldId: data.world_id };
}

async function restoreBlueprint(
  client: GubernatorSupabaseClient,
  input: RestoreBlueprintInput,
): Promise<RestoreBlueprintResult> {
  const values = parseInput(restoreBlueprintInputSchema, input);

  const { data, error } = await client
    .rpc("restore_building_blueprint", {
      p_blueprint_id: values.blueprintId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new BuildingMutationError({
        code: "building_blueprint_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_blueprint_not_found",
      message: "Blueprint could not be restored.",
    });
  }

  return { blueprintId: data.id, worldId: data.world_id };
}

async function hardDeleteBlueprint(
  client: GubernatorSupabaseClient,
  input: HardDeleteBlueprintInput,
): Promise<HardDeleteBlueprintResult> {
  const values = parseInput(hardDeleteBlueprintInputSchema, input);

  const { data, error } = await client
    .rpc("hard_delete_building_blueprint", {
      p_blueprint_id: values.blueprintId,
      p_world_id: values.worldId,
    })
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new BuildingMutationError({
        code: "building_blueprint_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_blueprint_not_found",
      message: "Blueprint could not be permanently deleted.",
    });
  }

  return { blueprintId: data.id, worldId: data.world_id };
}

async function createTier(
  client: GubernatorSupabaseClient,
  input: CreateTierInput,
): Promise<BuildingBlueprintTier> {
  const values = parseInput(createTierInputSchema, input);

  const insertPayload: TierInsertPayload = {
    building_blueprint_id: values.blueprintId,
    tier_number: values.tierNumber,
  };

  if (values.workerTurnsRequired !== undefined) {
    insertPayload.worker_turns_required = values.workerTurnsRequired;
  }
  if (values.constructionCostsJson !== undefined) {
    insertPayload.construction_costs_json = toCostJson(
      values.constructionCostsJson,
    );
  }
  if (values.upkeepCostsJson !== undefined) {
    insertPayload.upkeep_costs_json = toCostJson(values.upkeepCostsJson);
  }
  if (values.effectsJson !== undefined) {
    insertPayload.effects_json = toEffectJson(values.effectsJson);
  }

  const { data, error } = await client
    .from("building_blueprint_tiers")
    .insert(insertPayload)
    .select(TIER_SELECT)
    .maybeSingle<TierRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_tier_not_found",
      message: "Tier could not be created.",
    });
  }

  return toTier(data);
}

async function updateTier(
  client: GubernatorSupabaseClient,
  input: UpdateTierInput,
): Promise<BuildingBlueprintTier> {
  const values = parseInput(updateTierInputSchema, input);

  const updatePayload: TierUpdatePayload = {};

  if (values.workerTurnsRequired !== undefined) {
    updatePayload.worker_turns_required = values.workerTurnsRequired;
  }
  if (values.constructionCostsJson !== undefined) {
    updatePayload.construction_costs_json = toCostJson(
      values.constructionCostsJson,
    );
  }
  if (values.upkeepCostsJson !== undefined) {
    updatePayload.upkeep_costs_json = toCostJson(values.upkeepCostsJson);
  }
  if (values.effectsJson !== undefined) {
    updatePayload.effects_json = toEffectJson(values.effectsJson);
  }

  const { data, error } = await client
    .from("building_blueprint_tiers")
    .update(updatePayload)
    .eq("id", values.tierId)
    .select(TIER_SELECT)
    .maybeSingle<TierRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_tier_not_found",
      message: "Tier could not be updated.",
    });
  }

  return toTier(data);
}

async function deleteTier(
  client: GubernatorSupabaseClient,
  input: DeleteTierInput,
): Promise<DeleteTierResult> {
  const values = parseInput(deleteTierInputSchema, input);

  const { data, error } = await client
    .from("building_blueprint_tiers")
    .delete()
    .eq("id", values.tierId)
    .select("id,building_blueprint_id")
    .maybeSingle<{
      readonly building_blueprint_id: string;
      readonly id: string;
    }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new BuildingMutationError({
      code: "building_tier_not_found",
      message: "Tier could not be deleted.",
    });
  }

  return {
    blueprintId: data.building_blueprint_id,
    tierId: data.id,
  };
}

function toCostJson(entries: readonly TierCostEntry[]): Json {
  return entries.map(
    (e): Record<string, Json> => ({
      amount: e.amount,
      resource_id: e.resourceId,
    }),
  );
}

function toEffectJson(effects: readonly TierEffect[]): Json {
  return effects.map((e): Record<string, Json> => {
    switch (e.type) {
      case "job_capacity_increase":
        return { amount: e.amount, job_id: e.jobId, type: e.type };
      case "passive_resource_production":
        return { amount: e.amount, resource_id: e.resourceId, type: e.type };
      case "resource_storage_increase":
        return { amount: e.amount, resource_id: e.resourceId, type: e.type };
      case "population_cap_increase":
        return { amount: e.amount, type: e.type };
    }
  });
}

function toBlueprint(row: BlueprintRow): BuildingBlueprint {
  return {
    createdAt: row.created_at,
    description: row.description,
    gracePeriodTurns: row.grace_period_turns,
    id: row.id,
    isActive: row.is_active,
    maxInstancesPerSettlement: row.max_instances_per_settlement,
    name: row.name,
    slug: row.slug,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

function toCostEntry(row: TierCostEntryRow): TierCostEntry {
  return {
    amount: row.amount,
    resourceId: row.resource_id,
  };
}

function toTierEffect(row: TierEffectRow): TierEffect {
  switch (row.type) {
    case "job_capacity_increase":
      return {
        amount: row.amount,
        jobId: row.job_id,
        type: "job_capacity_increase",
      };
    case "passive_resource_production":
      return {
        amount: row.amount,
        resourceId: row.resource_id,
        type: "passive_resource_production",
      };
    case "resource_storage_increase":
      return {
        amount: row.amount,
        resourceId: row.resource_id,
        type: "resource_storage_increase",
      };
    case "population_cap_increase":
      return {
        amount: row.amount,
        type: "population_cap_increase",
      };
  }
}

function toTier(row: TierRow): BuildingBlueprintTier {
  return {
    buildingBlueprintId: row.building_blueprint_id,
    constructionCostsJson: row.construction_costs_json.map(toCostEntry),
    createdAt: row.created_at,
    effectsJson: row.effects_json.map(toTierEffect),
    id: row.id,
    tierNumber: row.tier_number,
    updatedAt: row.updated_at,
    upkeepCostsJson: row.upkeep_costs_json.map(toCostEntry),
    workerTurnsRequired: row.worker_turns_required,
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
      new BuildingMutationError({
        code: "building_input_invalid",
        issues,
        message: "Building input is invalid.",
      }),
  );
}
