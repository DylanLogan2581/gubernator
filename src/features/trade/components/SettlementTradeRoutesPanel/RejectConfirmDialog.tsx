import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { rejectTradeRouteSideMutationOptions } from "../../mutations/rejectTradeRouteSideMutations";

import type { TradeRoute } from "../../types/tradeRouteTypes";

type RejectConfirmDialogProps = {
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly rejectorCitizenId: string;
  readonly route: TradeRoute;
  readonly side: "destination" | "origin";
};

export function RejectConfirmDialog({
  counterpart,
  onClose,
  queryClient,
  rejectorCitizenId,
  route,
  side,
}: RejectConfirmDialogProps): JSX.Element {
  const mutation = useMutation(
    rejectTradeRouteSideMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await mutation.mutateAsync({
        rejectorCitizenId,
        side,
        tradeRouteId: route.id,
      });
      notifyMutationSuccess("Trade route rejected.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to reject trade route.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Reject trade route?"
      description={
        <>
          Reject the trade route with{" "}
          <span className="font-medium text-foreground">{counterpart}</span>?
          This cannot be undone.
        </>
      }
      confirmLabel="Reject"
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
