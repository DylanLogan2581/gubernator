import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { worldQueryKeys } from "./worldQueryKeys";

import type { WorldListStats } from "../types/worldTypes";

type WorldListStatsQueryKey = ReturnType<typeof worldQueryKeys.listStats>;
type WorldListStatsQueryOptions = UseQueryOptions<
  ReadonlyMap<string, WorldListStats>,
  AuthUiError,
  ReadonlyMap<string, WorldListStats>,
  WorldListStatsQueryKey
>;

type WorldListStatsRow = {
  readonly world_id: string;
  readonly player_character_count: number;
  readonly last_transition_at: string | null;
};

export function worldListStatsQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldListStatsQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldListStats(client),
    queryKey: worldQueryKeys.listStats(),
  });
}

async function getWorldListStats(
  client: GubernatorSupabaseClient,
): Promise<ReadonlyMap<string, WorldListStats>> {
  const { data, error } = await client
    .rpc("get_world_list_stats")
    .returns<WorldListStatsRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return new Map(
    (data ?? []).map((row) => [row.world_id, toWorldListStats(row)]),
  );
}

function toWorldListStats(row: WorldListStatsRow): WorldListStats {
  return {
    lastTransitionAt: row.last_transition_at,
    playerCharacterCount: row.player_character_count,
    worldId: row.world_id,
  };
}
