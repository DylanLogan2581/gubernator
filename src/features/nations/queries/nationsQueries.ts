import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { isSettlementReadyForCurrentTurn } from "@/features/settlements";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type {
  Nation,
  NationGovernmentType,
  NationSettlement,
  NationTradePolicy,
} from "../types/nationTypes";

type NationListQueryKey = ReturnType<typeof nationsQueryKeys.list>;
type NationDetailQueryKey = ReturnType<typeof nationsQueryKeys.detail>;
type NationSettlementsQueryKey = ReturnType<
  typeof nationsQueryKeys.settlements
>;

type NationListQueryOptions = UseQueryOptions<
  readonly Nation[],
  AuthUiError,
  readonly Nation[],
  NationListQueryKey
>;
type NationDetailQueryOptions = UseQueryOptions<
  Nation | null,
  AuthUiError,
  Nation | null,
  NationDetailQueryKey
>;
type NationSettlementsQueryOptions = UseQueryOptions<
  readonly NationSettlement[],
  AuthUiError,
  readonly NationSettlement[],
  NationSettlementsQueryKey
>;

type NationRow = {
  readonly capital_settlement_id: string | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly flag_path: string | null;
  readonly founded_turn_number: number | null;
  readonly government_type: string;
  readonly id: string;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly primary_culture_id: string | null;
  readonly state_religion_id: string | null;
  readonly tax_rate: number;
  readonly trade_policy: string;
  readonly updated_at: string;
  readonly world_id: string;
};
type NationSettlementRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly last_ready_at: string | null;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: {
    readonly name: string;
  };
  readonly ready_set_at: string | null;
};

const NATION_SELECT =
  "id,world_id,name,description,nameset_id,capital_settlement_id,founded_turn_number,government_type,flag_path,tax_rate,trade_policy,primary_culture_id,state_religion_id,created_at,updated_at";
const NATION_SETTLEMENT_SELECT =
  "id,name,nation_id,auto_ready_enabled,is_ready_current_turn,ready_set_at,last_ready_at,nations!settlements_nation_id_fkey!inner(name)";

export function nationsListQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationListQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationsList(client, worldId),
    queryKey: nationsQueryKeys.list(worldId),
  });
}

export function nationByIdQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationById(client, nationId),
    queryKey: nationsQueryKeys.detail(nationId),
  });
}

export function nationSettlementsQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationSettlementsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationSettlements(client, nationId),
    queryKey: nationsQueryKeys.settlements(nationId),
  });
}

async function getNationsList(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<readonly Nation[]> {
  const { data, error } = await client
    .from("nations")
    .select(NATION_SELECT)
    .eq("world_id", worldId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<NationRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toNation);
}

async function getNationById(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<Nation | null> {
  const { data, error } = await client
    .from("nations")
    .select(NATION_SELECT)
    .eq("id", nationId)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toNation(data);
}

async function getNationSettlements(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationSettlement[]> {
  const { data, error } = await client
    .from("settlements")
    .select(NATION_SETTLEMENT_SELECT)
    .eq("nation_id", nationId)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<NationSettlementRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  // Fetch population counts via RPC for each settlement
  const populationCounts = await Promise.all(
    data.map(async (settlement) => {
      const { data: count, error: rpcError } = await client.rpc(
        "settlement_alive_citizen_count",
        { p_settlement_id: settlement.id },
      );

      if (rpcError !== null) {
        throw normalizeSupabaseError(rpcError);
      }

      return count;
    }),
  );

  return data.map((row, index) =>
    toNationSettlement(row, populationCounts[index]),
  );
}

function toNation(row: NationRow): Nation {
  return {
    capitalSettlementId: row.capital_settlement_id,
    createdAt: row.created_at,
    description: row.description,
    flagPath: row.flag_path,
    foundedTurnNumber: row.founded_turn_number,
    governmentType: row.government_type as NationGovernmentType,
    id: row.id,
    name: row.name,
    namesetId: row.nameset_id,
    primaryCultureId: row.primary_culture_id,
    stateReligionId: row.state_religion_id,
    taxRate: row.tax_rate,
    tradePolicy: row.trade_policy as NationTradePolicy,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

function toNationSettlement(
  row: NationSettlementRow,
  population: number,
): NationSettlement {
  // isReadyForCurrentTurn mirrors is_ready_current_turn; auto-ready only takes effect at the
  // next turn advance (see settlementReadinessState.ts truth table).
  const isReadyForCurrentTurn = isSettlementReadyForCurrentTurn({
    auto_ready_enabled: row.auto_ready_enabled,
    is_ready_current_turn: row.is_ready_current_turn,
  });
  return {
    autoReadyEnabled: row.auto_ready_enabled,
    id: row.id,
    isReadyCurrentTurn: row.is_ready_current_turn,
    isReadyForCurrentTurn,
    lastReadyAt: row.last_ready_at,
    name: row.name,
    nationId: row.nation_id,
    nationName: row.nations.name,
    population,
    readySetAt: row.ready_set_at,
  };
}
