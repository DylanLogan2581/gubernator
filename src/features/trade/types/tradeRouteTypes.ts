export type TradeRouteStatus =
  | "active"
  | "cancelled"
  | "paused"
  | "proposed"
  | "replaced";

export type TradeRouteApprovalStatus = "approved" | "pending" | "rejected";

export type TradeRouteLegDirection = "receive" | "send";

export type TradeRouteLeg = {
  readonly direction: TradeRouteLegDirection;
  readonly id: string;
  readonly quantityPerTransition: number;
  readonly resourceId: string;
  readonly resourceName: string;
};

export type TradeRoute = {
  readonly createdAt: string;
  readonly destinationApprovalStatus: TradeRouteApprovalStatus;
  readonly destinationApprovedByCitizenId: string | null;
  readonly destinationNationName: string;
  readonly destinationSettlementId: string;
  readonly destinationSettlementName: string;
  readonly id: string;
  readonly legs: readonly TradeRouteLeg[];
  readonly originApprovalStatus: TradeRouteApprovalStatus;
  readonly originApprovedByCitizenId: string | null;
  readonly originNationName: string;
  readonly originSettlementId: string;
  readonly originSettlementName: string;
  readonly pauseReasonLastTransition: string | null;
  readonly proposedByCitizenId: string;
  readonly replacementForTradeRouteId: string | null;
  readonly status: TradeRouteStatus;
  readonly updatedAt: string;
};

export type ProposeTradeRouteResult = {
  readonly destinationSettlementId: string;
  readonly originSettlementId: string;
  readonly tradeRouteId: string;
};

export type ApproveTradeRouteSideResult = {
  readonly destinationSettlementId: string;
  readonly originSettlementId: string;
  readonly status: TradeRouteStatus;
  readonly tradeRouteId: string;
};

export type RejectTradeRouteSideResult = {
  readonly destinationSettlementId: string;
  readonly originSettlementId: string;
  readonly status: TradeRouteStatus;
  readonly tradeRouteId: string;
};

export type CancelTradeRouteResult = {
  readonly destinationSettlementId: string;
  readonly originSettlementId: string;
  readonly status: TradeRouteStatus;
  readonly tradeRouteId: string;
};

export type ReplaceTradeRouteResult = {
  readonly destinationSettlementId: string;
  readonly newTradeRouteId: string;
  readonly oldTradeRouteId: string;
  readonly originSettlementId: string;
};
