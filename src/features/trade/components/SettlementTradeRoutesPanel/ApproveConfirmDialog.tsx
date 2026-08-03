import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { approveTradeRouteSideMutationOptions } from "../../mutations/approveTradeRouteSideMutations";

import type { TradeRoute } from "../../types/tradeRouteTypes";

type ApproveConfirmDialogProps = {
  readonly approverCitizenId: string;
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly settlementId: string;
  readonly side: "destination" | "origin";
  readonly worldId: string;
};

export function ApproveConfirmDialog({
  approverCitizenId,
  counterpart,
  onClose,
  queryClient,
  route,
  settlementId,
  side,
  worldId,
}: ApproveConfirmDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title="Approve trade route?"
      description={
        <>
          Approve the{" "}
          <span className="font-medium text-foreground">
            {side === "origin" ? "origin" : "destination"}
          </span>{" "}
          side of the trade route with{" "}
          <span className="font-medium text-foreground">{counterpart}</span>?{" "}
          {route.originSettlementId === settlementId
            ? "The route becomes active once both sides have approved."
            : ""}
        </>
      }
      confirmLabel="Approve"
      confirmVariant="default"
      mutationOptions={approveTradeRouteSideMutationOptions({
        queryClient,
        worldId,
      })}
      input={{
        approverCitizenId,
        side,
        tradeRouteId: route.id,
      }}
      successMessage={(result) =>
        result.status === "active"
          ? "Trade route approved and now active."
          : "Trade route side approved."
      }
      errorFallback="Failed to approve trade route."
    />
  );
}
