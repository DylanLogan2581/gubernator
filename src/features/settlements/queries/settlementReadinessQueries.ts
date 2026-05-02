import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { settlementReadinessQueryKeys } from "./settlementReadinessQueryKeys";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";

type SettlementReadinessListQueryKey = ReturnType<
  typeof settlementReadinessQueryKeys.list
>;
type SettlementReadinessListQueryOptions = UseQueryOptions<
  readonly SettlementReadinessListItem[],
  AuthUiError,
  readonly SettlementReadinessListItem[],
  SettlementReadinessListQueryKey
>;
type SettlementReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly name: string;
  readonly nation_id: string;
  readonly ready_set_at: string | null;
};

const SETTLEMENT_READINESS_SELECT =
  "id,name,nation_id,auto_ready_enabled,is_ready_current_turn,ready_set_at,nations!inner()";

export function settlementReadinessListQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementReadinessListQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementReadinessList(client, worldId),
    queryKey: settlementReadinessQueryKeys.list(worldId),
  });
}

async function getSettlementReadinessList(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly SettlementReadinessListItem[]> {
  const { data, error } = await client
    .from("settlements")
    .select(SETTLEMENT_READINESS_SELECT)
    .eq("nations.world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<SettlementReadinessRow[]>();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data.map(toSettlementReadinessListItem);
}

function toSettlementReadinessListItem(
  row: SettlementReadinessRow,
): SettlementReadinessListItem {
  return {
    autoReadyEnabled: row.auto_ready_enabled,
    id: row.id,
    isReadyCurrentTurn: row.is_ready_current_turn,
    name: row.name,
    nationId: row.nation_id,
    readySetAt: row.ready_set_at,
  };
}
