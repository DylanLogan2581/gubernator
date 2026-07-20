import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { turnQueryKeys } from "./turnQueryKeys";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TurnLogBrowserFilter = {
  readonly citizenId?: string;
  readonly logCategory?: string;
  readonly nationId?: string;
  readonly resourceId?: string;
  readonly settlementId?: string;
  readonly turnFrom?: number;
  /** Exact completed-turn match (`turn_transitions.to_turn_number`). Used by
   *  the turn picker; independent of the turnFrom/turnTo range filters. */
  readonly turnNumber?: number;
  readonly turnTo?: number;
};

export type TurnLogBrowserEntry = {
  readonly citizenId: string | null;
  readonly citizenName: string | null;
  readonly fromTurnNumber: number;
  readonly id: string;
  readonly logCategory: string;
  readonly nationId: string | null;
  readonly nationName: string | null;
  readonly payloadJsonb: unknown;
  readonly resourceId: string | null;
  readonly settlementId: string | null;
  readonly settlementName: string | null;
  /** nation_id resolved from the joined settlement row; used when the log entry's own
   *  nation_id is null but a settlement is present (settlement always has a nation). */
  readonly settlementNationId: string | null;
  readonly toTurnNumber: number;
  readonly turnTransitionId: string;
  readonly worldId: string;
};

export type TurnLogBrowserPage = {
  readonly entries: readonly TurnLogBrowserEntry[];
  readonly totalCount: number;
};

export const TURN_LOG_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Private row type (raw Supabase shape including embedded join)
// ---------------------------------------------------------------------------

type TurnLogEntryRow = {
  readonly citizen_id: string | null;
  // Embedded via turn_log_entries_citizen_id_fkey. Null when citizen_id is null.
  readonly citizens: { readonly name: string } | null;
  // Denormalized from turn_transitions at insert time (issue #1283) so the
  // browser can order/filter/count without joining turn_transitions. Null
  // only for the rare turn_transition_id = null rows (manual actions outside
  // any transition), which the query below excludes.
  readonly from_turn_number: number | null;
  readonly id: string;
  readonly log_category: string;
  readonly nation_id: string | null;
  // Embedded via turn_log_entries_nation_id_fkey. Null when nation_id is null.
  readonly nations: { readonly name: string } | null;
  readonly payload_jsonb: unknown;
  readonly resource_id: string | null;
  readonly settlement_id: string | null;
  // Embedded via turn_log_entries_settlement_id_fkey. Null when settlement_id is null.
  readonly settlements: {
    readonly name: string;
    readonly nation_id: string;
  } | null;
  readonly to_turn_number: number | null;
  readonly turn_transition_id: string | null;
  readonly world_id: string;
};

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const TURN_LOG_SELECT = [
  "id",
  "turn_transition_id",
  "world_id",
  "from_turn_number",
  "to_turn_number",
  "nation_id",
  "settlement_id",
  "citizen_id",
  "resource_id",
  "log_category",
  "payload_jsonb",
  "citizens!turn_log_entries_citizen_id_fkey(name)",
  "settlements!turn_log_entries_settlement_id_fkey(name,nation_id)",
  "nations!turn_log_entries_nation_id_fkey(name)",
].join(",");

function toEntry(row: TurnLogEntryRow): TurnLogBrowserEntry {
  return {
    citizenId: row.citizen_id,
    citizenName: row.citizens?.name ?? null,
    fromTurnNumber: row.from_turn_number ?? 0,
    id: row.id,
    logCategory: row.log_category,
    nationId: row.nation_id,
    nationName: row.nations?.name ?? null,
    payloadJsonb: row.payload_jsonb,
    resourceId: row.resource_id,
    settlementId: row.settlement_id,
    settlementName: row.settlements?.name ?? null,
    settlementNationId: row.settlements?.nation_id ?? null,
    toTurnNumber: row.to_turn_number ?? 0,
    turnTransitionId: row.turn_transition_id ?? "",
    worldId: row.world_id,
  };
}

async function getTurnLogPage(
  client: GubernatorSupabaseClient,
  worldId: string,
  filter: TurnLogBrowserFilter,
  page: number,
): Promise<TurnLogBrowserPage> {
  const from = page * TURN_LOG_PAGE_SIZE;
  const to = from + TURN_LOG_PAGE_SIZE - 1;

  // to_turn_number/from_turn_number are denormalized onto turn_log_entries at
  // insert time (issue #1283) so ordering/filtering hits the row's own
  // indexed columns instead of joining+sorting on turn_transitions, which
  // exceeded the statement timeout on a partitioned world. `id` is a stable
  // tiebreaker so pagination doesn't repeat/skip rows that share a turn
  // number. turn_transition_id is only null for manual actions taken outside
  // any turn transition (which never carry a turn number to display);
  // excluding them here reproduces the old `!inner` embed's exclusion
  // behavior.
  //
  // count: "estimated" (not "exact") because the RLS SELECT policy calls
  // current_user_has_world_access(world_id) per row; an exact count has no
  // LIMIT to bound that, so on a many-turn world it re-triggers the same
  // statement timeout the ordering fix above solves for the paginated fetch.
  // "estimated" uses the planner's row estimate instead of scanning every
  // matching row, so the page total becomes approximate rather than exact.
  let query = client
    .from("turn_log_entries")
    .select(TURN_LOG_SELECT, { count: "estimated" })
    .eq("world_id", worldId)
    .not("turn_transition_id", "is", null)
    .order("to_turn_number", { ascending: false })
    .order("id", { ascending: false });

  if (filter.logCategory !== undefined) {
    query = query.eq("log_category", filter.logCategory);
  }
  if (filter.nationId !== undefined) {
    query = query.eq("nation_id", filter.nationId);
  }
  if (filter.settlementId !== undefined) {
    query = query.eq("settlement_id", filter.settlementId);
  }
  if (filter.citizenId !== undefined) {
    query = query.eq("citizen_id", filter.citizenId);
  }
  if (filter.resourceId !== undefined) {
    query = query.eq("resource_id", filter.resourceId);
  }
  if (filter.turnFrom !== undefined) {
    query = query.gte("from_turn_number", filter.turnFrom);
  }
  if (filter.turnTo !== undefined) {
    query = query.lte("to_turn_number", filter.turnTo);
  }
  if (filter.turnNumber !== undefined) {
    query = query.eq("to_turn_number", filter.turnNumber);
  }

  query = query.range(from, to);

  const { data, error, count } = await query.returns<TurnLogEntryRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    entries: (data ?? []).map(toEntry),
    totalCount: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export type TurnLogBrowserQueryKey = ReturnType<
  typeof turnQueryKeys.turnLogBrowser
>;

export function turnLogBrowserQueryOptions({
  filter,
  page,
  worldId,
}: {
  readonly filter: TurnLogBrowserFilter;
  readonly page: number;
  readonly worldId: string;
}): UseQueryOptions<
  TurnLogBrowserPage,
  Error,
  TurnLogBrowserPage,
  TurnLogBrowserQueryKey
> {
  const client = requireSupabaseClient();
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: turnQueryKeys.turnLogBrowser(
      worldId,
      filter as Record<string, unknown>,
      page,
    ),
    queryFn: () => getTurnLogPage(client, worldId, filter, page),
  });
}
