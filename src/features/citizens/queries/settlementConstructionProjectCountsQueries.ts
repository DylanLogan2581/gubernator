import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "./citizensQueryKeys";

import type { SettlementConstructionProjectCount } from "../types/bulkAssignmentTypes";

type SettlementConstructionProjectCountsQueryKey = ReturnType<
  typeof citizensQueryKeys.settlementConstructionProjectCounts
>;

type SettlementConstructionProjectCountsQueryOptions = UseQueryOptions<
  readonly SettlementConstructionProjectCount[],
  AuthUiError,
  readonly SettlementConstructionProjectCount[],
  SettlementConstructionProjectCountsQueryKey
>;

type SettlementConstructionProjectCountRow = {
  readonly construction_project_id: string;
  readonly status: string;
  readonly queue_position: number;
  readonly current_count: number;
  readonly building_blueprint_id: string;
  readonly target_tier_id: string;
};

export function settlementConstructionProjectCountsQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementConstructionProjectCountsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementConstructionProjectCounts(client, settlementId),
    queryKey:
      citizensQueryKeys.settlementConstructionProjectCounts(settlementId),
  });
}

async function getSettlementConstructionProjectCounts(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly SettlementConstructionProjectCount[]> {
  const { data, error } = await client
    .rpc("get_settlement_construction_project_counts", {
      p_settlement_id: settlementId,
    })
    .returns<SettlementConstructionProjectCountRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return (data ?? []).map(toSettlementConstructionProjectCount);
}

function toSettlementConstructionProjectCount(
  row: SettlementConstructionProjectCountRow,
): SettlementConstructionProjectCount {
  return {
    constructionProjectId: row.construction_project_id,
    status: row.status,
    queuePosition: row.queue_position,
    currentCount: row.current_count,
    buildingBlueprintId: row.building_blueprint_id,
    targetTierId: row.target_tier_id,
  };
}
