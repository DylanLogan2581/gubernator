import type { TradeRouteLegDirection } from "../types/tradeRouteTypes";

const TRADE_ROUTE_LEG_DIRECTIONS = new Set<string>(["receive", "send"]);

export function parseTradeRouteLegDirection(
  value: string,
): TradeRouteLegDirection {
  if (!TRADE_ROUTE_LEG_DIRECTIONS.has(value)) {
    throw new Error(
      `Unknown trade route leg direction from database: "${value}"`,
    );
  }
  return value as TradeRouteLegDirection;
}
