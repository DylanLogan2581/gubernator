import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

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
};

export function ApproveConfirmDialog({
  approverCitizenId,
  counterpart,
  onClose,
  queryClient,
  route,
  settlementId,
  side,
}: ApproveConfirmDialogProps): JSX.Element {
  const mutation = useMutation(
    approveTradeRouteSideMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      const result = await mutation.mutateAsync({
        approverCitizenId,
        side,
        tradeRouteId: route.id,
      });
      const label =
        result.status === "active"
          ? "Trade route approved and now active."
          : "Trade route side approved.";
      notifyMutationSuccess(label);
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to approve trade route.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
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
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
