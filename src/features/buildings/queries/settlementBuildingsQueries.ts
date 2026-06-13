import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import {
  computeEffectsDigest,
  type SettlementBuilding,
  type SettlementBuildingState,
} from "../types/settlementBuildingTypes";

import { toTierEffect, type TierEffectRow } from "./buildingRow";
import { buildingsQueryKeys } from "./buildingsQueryKeys";

type SettlementBuildingRow = {
  readonly activated_on_turn_number: number;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly effects_json: readonly TierEffectRow[];
    readonly tier_number: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly created_at: string;
  readonly current_tier_id: string;
  readonly deactivated_in_transition_id: string | null;
  readonly id: string;
  readonly missed_upkeep_count: number;
  readonly name: string | null;
  readonly settlement_id: string;
  readonly source_project_id: string | null;
  readonly state: SettlementBuildingState;
  readonly updated_at: string;
};

type SettlementBuildingWithLocationRow = {
  readonly activated_on_turn_number: number;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly effects_json: readonly TierEffectRow[];
    readonly tier_number: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly created_at: string;
  readonly current_tier_id: string;
  readonly deactivated_in_transition_id: string | null;
  readonly id: string;
  readonly missed_upkeep_count: number;
  readonly name: string | null;
  readonly settlement_id: string;
  readonly settlements: {
    readonly id: string;
    readonly name: string;
    readonly nations: { readonly name: string };
  };
  readonly source_project_id: string | null;
  readonly state: SettlementBuildingState;
  readonly updated_at: string;
};

export type SettlementBuildingWithLocation = SettlementBuilding & {
  readonly settlementName: string;
  readonly nationName: string;
};

const SETTLEMENT_BUILDING_SELECT =
  "id,settlement_id,building_blueprint_id,current_tier_id,name,state,missed_upkeep_count,activated_on_turn_number,deactivated_in_transition_id,source_project_id,created_at,updated_at,building_blueprints(name),building_blueprint_tiers(tier_number,effects_json)";

const SETTLEMENT_BUILDING_WITH_LOCATION_SELECT =
  "id,settlement_id,building_blueprint_id,current_tier_id,name,state,missed_upkeep_count,activated_on_turn_number,deactivated_in_transition_id,source_project_id,created_at,updated_at,building_blueprints(name),building_blueprint_tiers(tier_number,effects_json),settlements(id,name,nations!inner(name))";

type SettlementBuildingsBySettlementQueryKey = ReturnType<
  typeof buildingsQueryKeys.settlementBuildingsBySettlement
>;

type SettlementBuildingsBySettlementQueryOptions = UseQueryOptions<
  readonly SettlementBuilding[],
  AuthUiError,
  readonly SettlementBuilding[],
  SettlementBuildingsBySettlementQueryKey
>;

export function settlementBuildingsBySettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementBuildingsBySettlementQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getSettlementBuildingsBySettlement(c, settlementId),
    queryKey: buildingsQueryKeys.settlementBuildingsBySettlement(settlementId),
  });
}

async function getSettlementBuildingsBySettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly SettlementBuilding[]> {
  const { data, error } = await client
    .from("settlement_buildings")
    .select(SETTLEMENT_BUILDING_SELECT)
    .eq("settlement_id", settlementId)
    .order("created_at", { ascending: true })
    .returns<SettlementBuildingRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toSettlementBuilding);
}

type SettlementBuildingsByNationsQueryKey = ReturnType<
  typeof buildingsQueryKeys.settlementBuildingsByNations
>;

type SettlementBuildingsByNationsQueryOptions = UseQueryOptions<
  readonly SettlementBuildingWithLocation[],
  AuthUiError,
  readonly SettlementBuildingWithLocation[],
  SettlementBuildingsByNationsQueryKey
>;

type SettlementBuildingsByWorldQueryKey = ReturnType<
  typeof buildingsQueryKeys.settlementBuildingsByWorld
>;

type SettlementBuildingsByWorldQueryOptions = UseQueryOptions<
  readonly SettlementBuildingWithLocation[],
  AuthUiError,
  readonly SettlementBuildingWithLocation[],
  SettlementBuildingsByWorldQueryKey
>;

export function settlementBuildingsByNationsQueryOptions(
  nationIds: readonly string[],
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementBuildingsByNationsQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getSettlementBuildingsByNations(c, nationIds),
    queryKey: buildingsQueryKeys.settlementBuildingsByNations(nationIds),
  });
}

export function settlementBuildingsByWorldQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementBuildingsByWorldQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getSettlementBuildingsByWorld(c, worldId),
    queryKey: buildingsQueryKeys.settlementBuildingsByWorld(worldId),
  });
}

async function getSettlementBuildingsByNations(
  client: GubernatorSupabaseClient,
  nationIds: readonly string[],
): Promise<readonly SettlementBuildingWithLocation[]> {
  const { data, error } = await client
    .from("settlement_buildings")
    .select(SETTLEMENT_BUILDING_WITH_LOCATION_SELECT)
    .in("settlements.nation_id", nationIds as string[])
    .order("settlements(name)", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<SettlementBuildingWithLocationRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toSettlementBuildingWithLocation);
}

async function getSettlementBuildingsByWorld(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly SettlementBuildingWithLocation[]> {
  const { data, error } = await client
    .from("settlement_buildings")
    .select(SETTLEMENT_BUILDING_WITH_LOCATION_SELECT)
    .eq("settlements.nations.world_id", worldId)
    .order("settlements(name)", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<SettlementBuildingWithLocationRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toSettlementBuildingWithLocation);
}

function toSettlementBuilding(row: SettlementBuildingRow): SettlementBuilding {
  const effectsJson =
    row.building_blueprint_tiers.effects_json.map(toTierEffect);
  return {
    activatedOnTurnNumber: row.activated_on_turn_number,
    blueprintName: row.building_blueprints.name,
    buildingBlueprintId: row.building_blueprint_id,
    createdAt: row.created_at,
    currentTierId: row.current_tier_id,
    deactivatedInTransitionId: row.deactivated_in_transition_id,
    effectsDigest: computeEffectsDigest(effectsJson),
    effectsJson,
    id: row.id,
    missedUpkeepCount: row.missed_upkeep_count,
    name: row.name,
    settlementId: row.settlement_id,
    sourceProjectId: row.source_project_id,
    state: row.state,
    tierNumber: row.building_blueprint_tiers.tier_number,
    updatedAt: row.updated_at,
  };
}

function toSettlementBuildingWithLocation(
  row: SettlementBuildingWithLocationRow,
): SettlementBuildingWithLocation {
  const effectsJson =
    row.building_blueprint_tiers.effects_json.map(toTierEffect);
  return {
    activatedOnTurnNumber: row.activated_on_turn_number,
    blueprintName: row.building_blueprints.name,
    buildingBlueprintId: row.building_blueprint_id,
    createdAt: row.created_at,
    currentTierId: row.current_tier_id,
    deactivatedInTransitionId: row.deactivated_in_transition_id,
    effectsDigest: computeEffectsDigest(effectsJson),
    effectsJson,
    id: row.id,
    missedUpkeepCount: row.missed_upkeep_count,
    name: row.name,
    settlementId: row.settlement_id,
    settlementName: row.settlements.name,
    nationName: row.settlements.nations.name,
    sourceProjectId: row.source_project_id,
    state: row.state,
    tierNumber: row.building_blueprint_tiers.tier_number,
    updatedAt: row.updated_at,
  };
}
