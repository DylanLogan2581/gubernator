import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { settlementsQueryKeys } from "./settlementsQueryKeys";

import type { SettlementWithNation } from "../types/settlementTypes";

type SettlementDetailQueryKey = ReturnType<typeof settlementsQueryKeys.detail>;
type SettlementDetailQueryOptions = UseQueryOptions<
  SettlementWithNation | null,
  AuthUiError,
  SettlementWithNation | null,
  SettlementDetailQueryKey
>;

type SettlementWithNationRow = {
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: {
    readonly id: string;
    readonly name: string;
    readonly world_id: string;
  };
  readonly updated_at: string;
};

const SETTLEMENT_WITH_NATION_SELECT =
  "id,nation_id,name,description,coord_x,coord_z,created_at,updated_at,nations!inner(id,name,world_id)";

export function settlementByIdQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementById(client, settlementId),
    queryKey: settlementsQueryKeys.detail(settlementId),
  });
}

async function getSettlementById(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<SettlementWithNation | null> {
  const { data, error } = await client
    .from("settlements")
    .select(SETTLEMENT_WITH_NATION_SELECT)
    .eq("id", settlementId)
    .maybeSingle<SettlementWithNationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toSettlementWithNation(data);
}

function toSettlementWithNation(
  row: SettlementWithNationRow,
): SettlementWithNation {
  return {
    coordX: row.coord_x,
    coordZ: row.coord_z,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    nation: {
      id: row.nations.id,
      name: row.nations.name,
      worldId: row.nations.world_id,
    },
    nationId: row.nation_id,
    updatedAt: row.updated_at,
  };
}
