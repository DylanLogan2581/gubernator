import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { buildingsQueryKeys } from "@/features/buildings";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import type {
  ConstructionProject,
  ConstructionProjectStatus,
} from "../types/constructionProjectTypes";

type ConstructionProjectRow = {
  readonly activated_on_turn_number: number | null;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly tier_number: number;
    readonly worker_turns_required: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly completed_in_transition_id: string | null;
  readonly created_at: string;
  readonly id: string;
  readonly progress_worker_turns: number;
  readonly queue_position: number;
  readonly settlement_id: string;
  readonly status: ConstructionProjectStatus;
  readonly target_tier_id: string;
  readonly updated_at: string;
};

const CONSTRUCTION_PROJECT_SELECT =
  "id,settlement_id,building_blueprint_id,target_tier_id,status,queue_position,progress_worker_turns,completed_in_transition_id,activated_on_turn_number,created_at,updated_at,building_blueprints(name),building_blueprint_tiers(tier_number,worker_turns_required)";

type ConstructionProjectsBySettlementQueryKey = ReturnType<
  typeof buildingsQueryKeys.constructionProjectsBySettlement
>;

type ConstructionProjectsBySettlementQueryOptions = UseQueryOptions<
  readonly ConstructionProject[],
  AuthUiError,
  readonly ConstructionProject[],
  ConstructionProjectsBySettlementQueryKey
>;

export function constructionProjectsBySettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ConstructionProjectsBySettlementQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getConstructionProjectsBySettlement(c, settlementId),
    queryKey: buildingsQueryKeys.constructionProjectsBySettlement(settlementId),
  });
}

async function getConstructionProjectsBySettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly ConstructionProject[]> {
  const { data, error } = await client
    .from("construction_projects")
    .select(CONSTRUCTION_PROJECT_SELECT)
    .eq("settlement_id", settlementId)
    .order("queue_position", { ascending: true })
    .returns<ConstructionProjectRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toConstructionProject);
}

function toConstructionProject(
  row: ConstructionProjectRow,
): ConstructionProject {
  return {
    activatedOnTurnNumber: row.activated_on_turn_number,
    blueprintName: row.building_blueprints.name,
    buildingBlueprintId: row.building_blueprint_id,
    completedInTransitionId: row.completed_in_transition_id,
    createdAt: row.created_at,
    id: row.id,
    progressWorkerTurns: row.progress_worker_turns,
    queuePosition: row.queue_position,
    settlementId: row.settlement_id,
    status: row.status,
    targetTierId: row.target_tier_id,
    tierNumber: row.building_blueprint_tiers.tier_number,
    updatedAt: row.updated_at,
    workerTurnsRequired: row.building_blueprint_tiers.worker_turns_required,
  };
}
