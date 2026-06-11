import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { tradeRoutesQueryKeys } from "./tradeRoutesQueryKeys";

import type {
  TradeRoute,
  TradeRouteApprovalStatus,
  TradeRouteLeg,
  TradeRouteStatus,
} from "../types/tradeRouteTypes";

type SettlementWithNationRow = {
  readonly name: string;
  readonly nation: { readonly name: string };
};

type TradeRouteLegRow = {
  readonly direction: string;
  readonly id: string;
  readonly quantity_per_transition: number;
  readonly resource_id: string;
  readonly resource: { readonly name: string };
};

type TradeRouteRow = {
  readonly created_at: string;
  readonly destination_approval_status: TradeRouteApprovalStatus;
  readonly destination_approved_by_citizen_id: string | null;
  readonly destination_settlement: SettlementWithNationRow;
  readonly destination_settlement_id: string;
  readonly id: string;
  readonly origin_approval_status: TradeRouteApprovalStatus;
  readonly origin_approved_by_citizen_id: string | null;
  readonly origin_settlement: SettlementWithNationRow;
  readonly origin_settlement_id: string;
  readonly pause_reason_last_transition: string | null;
  readonly proposed_by_citizen_id: string;
  readonly replacement_for_trade_route_id: string | null;
  readonly status: TradeRouteStatus;
  readonly trade_route_legs: readonly TradeRouteLegRow[];
  readonly updated_at: string;
};

const TRADE_ROUTE_SELECT = [
  "id",
  "origin_settlement_id",
  "destination_settlement_id",
  "status",
  "proposed_by_citizen_id",
  "origin_approval_status",
  "destination_approval_status",
  "origin_approved_by_citizen_id",
  "destination_approved_by_citizen_id",
  "replacement_for_trade_route_id",
  "pause_reason_last_transition",
  "created_at",
  "updated_at",
  "origin_settlement:settlements!trade_routes_origin_settlement_id_fkey(name,nation:nations(name))",
  "destination_settlement:settlements!trade_routes_destination_settlement_id_fkey(name,nation:nations(name))",
  "trade_route_legs(id,direction,resource_id,quantity_per_transition,resource:resources(name))",
].join(",");

type TradeRoutesForSettlementQueryKey = ReturnType<
  typeof tradeRoutesQueryKeys.forSettlement
>;

type TradeRoutesForSettlementQueryOptions = UseQueryOptions<
  readonly TradeRoute[],
  AuthUiError,
  readonly TradeRoute[],
  TradeRoutesForSettlementQueryKey
>;

export function tradeRoutesForSettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TradeRoutesForSettlementQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getTradeRoutesForSettlement(c, settlementId),
    queryKey: tradeRoutesQueryKeys.forSettlement(settlementId),
  });
}

async function getTradeRoutesForSettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly TradeRoute[]> {
  const { data, error } = await client
    .from("trade_routes")
    .select(TRADE_ROUTE_SELECT)
    .or(
      `origin_settlement_id.eq.${settlementId},destination_settlement_id.eq.${settlementId}`,
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .returns<TradeRouteRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toTradeRoute);
}

function toTradeRoute(row: TradeRouteRow): TradeRoute {
  return {
    createdAt: row.created_at,
    destinationApprovalStatus: row.destination_approval_status,
    destinationApprovedByCitizenId: row.destination_approved_by_citizen_id,
    destinationNationName: row.destination_settlement.nation.name,
    destinationSettlementId: row.destination_settlement_id,
    destinationSettlementName: row.destination_settlement.name,
    id: row.id,
    legs: row.trade_route_legs.map(toLeg),
    originApprovalStatus: row.origin_approval_status,
    originApprovedByCitizenId: row.origin_approved_by_citizen_id,
    originNationName: row.origin_settlement.nation.name,
    originSettlementId: row.origin_settlement_id,
    originSettlementName: row.origin_settlement.name,
    pauseReasonLastTransition: row.pause_reason_last_transition,
    proposedByCitizenId: row.proposed_by_citizen_id,
    replacementForTradeRouteId: row.replacement_for_trade_route_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function toLeg(row: TradeRouteLegRow): TradeRouteLeg {
  return {
    direction: row.direction as TradeRouteLeg["direction"],
    id: row.id,
    quantityPerTransition: row.quantity_per_transition,
    resourceId: row.resource_id,
    resourceName: row.resource.name,
  };
}
