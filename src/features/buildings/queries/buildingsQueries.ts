import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { buildingsQueryKeys } from "./buildingsQueryKeys";

import type {
  BuildingBlueprint,
  BuildingBlueprintTier,
  TierCostEntry,
  TierEffect,
} from "../types/buildingTypes";

type BlueprintsByWorldQueryKey = ReturnType<
  typeof buildingsQueryKeys.blueprintsByWorld
>;
type TiersByBlueprintQueryKey = ReturnType<
  typeof buildingsQueryKeys.tiersByBlueprint
>;
type BlueprintDetailQueryKey = ReturnType<
  typeof buildingsQueryKeys.blueprintById
>;
type TierDetailQueryKey = ReturnType<typeof buildingsQueryKeys.tierById>;

type BlueprintsByWorldQueryOptions = UseQueryOptions<
  readonly BuildingBlueprint[],
  AuthUiError,
  readonly BuildingBlueprint[],
  BlueprintsByWorldQueryKey
>;
type TiersByBlueprintQueryOptions = UseQueryOptions<
  readonly BuildingBlueprintTier[],
  AuthUiError,
  readonly BuildingBlueprintTier[],
  TiersByBlueprintQueryKey
>;
type BlueprintDetailQueryOptions = UseQueryOptions<
  BuildingBlueprint | null,
  AuthUiError,
  BuildingBlueprint | null,
  BlueprintDetailQueryKey
>;
type TierDetailQueryOptions = UseQueryOptions<
  BuildingBlueprintTier | null,
  AuthUiError,
  BuildingBlueprintTier | null,
  TierDetailQueryKey
>;

type BlueprintRow = {
  readonly created_at: string;
  readonly id: string;
  readonly is_active: boolean;
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
  "id,world_id,name,slug,is_active,created_at,updated_at";

const TIER_SELECT =
  "id,building_blueprint_id,tier_number,worker_turns_required,construction_costs_json,upkeep_costs_json,effects_json,created_at,updated_at";

export function blueprintsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BlueprintsByWorldQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getBlueprintsByWorld(client, worldId),
    queryKey: buildingsQueryKeys.blueprintsByWorld(worldId),
  });
}

export function tiersByBlueprintQueryOptions(
  blueprintId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TiersByBlueprintQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getTiersByBlueprint(client, blueprintId),
    queryKey: buildingsQueryKeys.tiersByBlueprint(blueprintId),
  });
}

export function blueprintByIdQueryOptions(
  blueprintId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): BlueprintDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getBlueprintById(client, blueprintId),
    queryKey: buildingsQueryKeys.blueprintById(blueprintId),
  });
}

export function tierByIdQueryOptions(
  tierId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TierDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getTierById(client, tierId),
    queryKey: buildingsQueryKeys.tierById(tierId),
  });
}

async function getBlueprintsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly BuildingBlueprint[]> {
  const { data, error } = await client
    .from("building_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<BlueprintRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toBlueprint);
}

async function getTiersByBlueprint(
  client: GubernatorSupabaseClient,
  blueprintId: string,
): Promise<readonly BuildingBlueprintTier[]> {
  const { data, error } = await client
    .from("building_blueprint_tiers")
    .select(TIER_SELECT)
    .eq("building_blueprint_id", blueprintId)
    .order("tier_number", { ascending: true })
    .returns<TierRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toTier);
}

async function getBlueprintById(
  client: GubernatorSupabaseClient,
  blueprintId: string,
): Promise<BuildingBlueprint | null> {
  const { data, error } = await client
    .from("building_blueprints")
    .select(BLUEPRINT_SELECT)
    .eq("id", blueprintId)
    .maybeSingle<BlueprintRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toBlueprint(data);
}

async function getTierById(
  client: GubernatorSupabaseClient,
  tierId: string,
): Promise<BuildingBlueprintTier | null> {
  const { data, error } = await client
    .from("building_blueprint_tiers")
    .select(TIER_SELECT)
    .eq("id", tierId)
    .maybeSingle<TierRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toTier(data);
}

function toBlueprint(row: BlueprintRow): BuildingBlueprint {
  return {
    createdAt: row.created_at,
    id: row.id,
    isActive: row.is_active,
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
