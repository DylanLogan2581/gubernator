import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { resourcesQueryKeys } from "./resourcesQueryKeys";

export type SettlementStockpile = {
  readonly effectiveCap: number;
  readonly isSystemResource: boolean;
  readonly quantity: number;
  readonly resourceId: string;
  readonly resourceName: string;
  readonly settlementId: string;
};

type StockpileRow = {
  readonly effective_cap: number;
  readonly is_system_resource: boolean;
  readonly quantity: number;
  readonly resource_id: string;
  readonly resource_name: string;
  readonly settlement_id: string;
};

type SettlementStockpilesQueryKey = ReturnType<
  typeof resourcesQueryKeys.stockpilesBySettlement
>;

type SettlementStockpilesQueryOptions = UseQueryOptions<
  readonly SettlementStockpile[],
  AuthUiError,
  readonly SettlementStockpile[],
  SettlementStockpilesQueryKey
>;

const STOCKPILE_SELECT =
  "settlement_id,resource_id,resource_name,is_system_resource,quantity,effective_cap";

function toStockpile(row: StockpileRow): SettlementStockpile {
  return {
    effectiveCap: row.effective_cap,
    isSystemResource: row.is_system_resource,
    quantity: row.quantity,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    settlementId: row.settlement_id,
  };
}

export function settlementStockpilesByIdQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementStockpilesQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getSettlementStockpiles(c, settlementId),
    queryKey: resourcesQueryKeys.stockpilesBySettlement(settlementId),
  });
}

async function getSettlementStockpiles(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly SettlementStockpile[]> {
  const { data, error } = await client
    .from("settlement_stockpiles_view")
    .select(STOCKPILE_SELECT)
    .eq("settlement_id", settlementId)
    .order("resource_name", { ascending: true })
    .order("resource_id", { ascending: true })
    .returns<StockpileRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toStockpile);
}
