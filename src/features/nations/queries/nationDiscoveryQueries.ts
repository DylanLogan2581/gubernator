import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type { NationDiscoveryPair } from "../types/nationTypes";

type NationDiscoveriesQueryKey = ReturnType<
  typeof nationsQueryKeys.discoveries
>;

type NationDiscoveriesQueryOptions = UseQueryOptions<
  readonly NationDiscoveryPair[],
  AuthUiError,
  readonly NationDiscoveryPair[],
  NationDiscoveriesQueryKey
>;

type NationDiscoveryRow = {
  readonly created_by_user_id: string | null;
  readonly met_at_turn_number: number;
  readonly nation_a_id: string;
  readonly nation_b_id: string;
};

const NATION_DISCOVERY_SELECT =
  "nation_a_id,nation_b_id,met_at_turn_number,created_by_user_id";

export function nationDiscoveriesQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationDiscoveriesQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationDiscoveries(client, worldId),
    queryKey: nationsQueryKeys.discoveries(worldId),
  });
}

async function getNationDiscoveries(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly NationDiscoveryPair[]> {
  const { data, error } = await client
    .from("nation_discoveries")
    .select(NATION_DISCOVERY_SELECT)
    .eq("world_id", worldId)
    .returns<NationDiscoveryRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toNationDiscoveryPair);
}

function toNationDiscoveryPair(row: NationDiscoveryRow): NationDiscoveryPair {
  return {
    createdByUserId: row.created_by_user_id,
    metAtTurnNumber: row.met_at_turn_number,
    nationAId: row.nation_a_id,
    nationBId: row.nation_b_id,
  };
}
