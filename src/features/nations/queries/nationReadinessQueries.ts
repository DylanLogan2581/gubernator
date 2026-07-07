import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Database } from "@/types/database";

import { nationReadinessQueryKeys } from "./nationReadinessQueryKeys";

import type {
  NationReadinessListItem,
  NationReadinessMode,
} from "../types/nationReadinessTypes";
import type { NationGovernmentType } from "../types/nationTypes";

type NationReadinessSummaryRow =
  Database["public"]["Functions"]["nation_readiness_summary"]["Returns"][number];

type NationReadinessListQueryKey = ReturnType<
  typeof nationReadinessQueryKeys.list
>;
type NationReadinessListQueryOptions = UseQueryOptions<
  readonly NationReadinessListItem[],
  AuthUiError,
  readonly NationReadinessListItem[],
  NationReadinessListQueryKey
>;

export function nationReadinessListQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationReadinessListQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationReadinessList(client, worldId),
    queryKey: nationReadinessQueryKeys.list(worldId),
  });
}

async function getNationReadinessList(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly NationReadinessListItem[]> {
  const { data, error } = await client.rpc("nation_readiness_summary", {
    p_world_id: worldId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .map(toNationReadinessListItem)
    .sort((a, b) => a.nationName.localeCompare(b.nationName));
}

function toNationReadinessListItem(
  row: NationReadinessSummaryRow,
): NationReadinessListItem {
  return {
    eligibleVoterCount: row.eligible_voter_count,
    governmentType: row.government_type as NationGovernmentType,
    hasSettlements: row.has_settlements,
    isReady: row.is_ready,
    nationId: row.nation_id,
    nationName: row.nation_name,
    readinessMode: row.readiness_mode as NationReadinessMode,
    trueVoteCount: row.true_vote_count,
  };
}
