import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { cancelTradeRouteMutationOptions } from "../../mutations/cancelTradeRouteMutations";

import type { TradeRoute } from "../../types/tradeRouteTypes";

type CancelConfirmDialogProps = {
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly traderCount: number;
};

export function CancelConfirmDialog({
  counterpart,
  onClose,
  queryClient,
  route,
  traderCount,
}: CancelConfirmDialogProps): JSX.Element {
  const mutation = useMutation(
    cancelTradeRouteMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    const countBefore = traderCount;
    try {
      await mutation.mutateAsync({ tradeRouteId: route.id });
      if (countBefore > 0) {
        notifyMutationSuccess(
          `Trade route cancelled. ${countBefore.toString()} ${countBefore === 1 ? "trader was" : "traders were"} unassigned.`,
        );
      } else {
        notifyMutationSuccess("Trade route cancelled.");
      }
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to cancel trade route.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel trade route?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Cancel the trade route with{" "}
          <span className="font-medium text-foreground">{counterpart}</span>?
          {traderCount > 0 ? (
            <>
              {" "}
              <span className="font-medium text-foreground">
                {traderCount.toString()}{" "}
                {traderCount === 1 ? "trader" : "traders"}
              </span>{" "}
              will be unassigned.
            </>
          ) : null}
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Keep
          </Button>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Cancel route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
