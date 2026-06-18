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
  readonly turnTo?: number;
};

export type TurnLogBrowserEntry = {
  readonly citizenId: string | null;
  readonly fromTurnNumber: number;
  readonly id: string;
  readonly logCategory: string;
  readonly nationId: string | null;
  readonly payloadJsonb: unknown;
  readonly resourceId: string | null;
  readonly settlementId: string | null;
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
  readonly id: string;
  readonly log_category: string;
  readonly nation_id: string | null;
  readonly payload_jsonb: unknown;
  readonly resource_id: string | null;
  readonly settlement_id: string | null;
  readonly turn_transition_id: string;
  // Embedded via turn_log_entries_transition_world_fkey (composite FK).
  // null only if the join fails (data integrity issue); treated as turn 0.
  readonly turn_transitions: {
    readonly from_turn_number: number;
    readonly to_turn_number: number;
  } | null;
  readonly world_id: string;
};

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

const TURN_LOG_SELECT = [
  "id",
  "turn_transition_id",
  "world_id",
  "nation_id",
  "settlement_id",
  "citizen_id",
  "resource_id",
  "log_category",
  "payload_jsonb",
  "turn_transitions!turn_log_entries_transition_world_fkey!inner(from_turn_number,to_turn_number)",
].join(",");

function toEntry(row: TurnLogEntryRow): TurnLogBrowserEntry {
  return {
    citizenId: row.citizen_id,
    fromTurnNumber: row.turn_transitions?.from_turn_number ?? 0,
    id: row.id,
    logCategory: row.log_category,
    nationId: row.nation_id,
    payloadJsonb: row.payload_jsonb,
    resourceId: row.resource_id,
    settlementId: row.settlement_id,
    toTurnNumber: row.turn_transitions?.to_turn_number ?? 0,
    turnTransitionId: row.turn_transition_id,
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

  // Supabase v2 supports ordering by an embedded resource column via the
  // referencedTable option, which generates ?order=turn_transitions.to_turn_number.desc.
  let query = client
    .from("turn_log_entries")
    .select(TURN_LOG_SELECT, { count: "exact" })
    .eq("world_id", worldId)
    .order("to_turn_number", {
      referencedTable: "turn_transitions",
      ascending: false,
    });

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
  // Turn range filters operate on the embedded turn_transitions resource.
  // PostgREST translates ?turn_transitions.from_turn_number=gte.N into a
  // WHERE clause on the joined turn_transitions rows.
  if (filter.turnFrom !== undefined) {
    query = query.filter(
      "turn_transitions.from_turn_number",
      "gte",
      filter.turnFrom,
    );
  }
  if (filter.turnTo !== undefined) {
    query = query.filter(
      "turn_transitions.to_turn_number",
      "lte",
      filter.turnTo,
    );
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
