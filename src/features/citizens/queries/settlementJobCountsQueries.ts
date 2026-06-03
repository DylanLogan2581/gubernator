import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "./citizensQueryKeys";

import type { SettlementJobCount } from "../types/bulkAssignmentTypes";

type SettlementJobCountsQueryKey = ReturnType<
  typeof citizensQueryKeys.settlementJobCounts
>;

type SettlementJobCountsQueryOptions = UseQueryOptions<
  readonly SettlementJobCount[],
  AuthUiError,
  readonly SettlementJobCount[],
  SettlementJobCountsQueryKey
>;

type SettlementJobCountRow = {
  readonly capacity: number;
  readonly current_count: number;
  readonly job_id: string;
  readonly job_name: string;
  readonly job_slug: string;
  readonly world_id: string;
};

export function settlementJobCountsQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementJobCountsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementJobCounts(client, settlementId),
    queryKey: citizensQueryKeys.settlementJobCounts(settlementId),
  });
}

async function getSettlementJobCounts(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly SettlementJobCount[]> {
  const { data, error } = await client
    .rpc("get_settlement_standard_job_counts", {
      p_settlement_id: settlementId,
    })
    .returns<SettlementJobCountRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return (data ?? []).map(toSettlementJobCount);
}

function toSettlementJobCount(row: SettlementJobCountRow): SettlementJobCount {
  return {
    capacity: row.capacity,
    currentCount: row.current_count,
    jobId: row.job_id,
    jobName: row.job_name,
    jobSlug: row.job_slug,
    worldId: row.world_id,
  };
}
