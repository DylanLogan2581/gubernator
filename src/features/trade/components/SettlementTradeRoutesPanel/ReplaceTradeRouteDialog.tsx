import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { replaceTradeRouteMutationOptions } from "../../mutations/replaceTradeRouteMutations";

import type { TradeRoute } from "../../types/tradeRouteTypes";

type ReplaceTradeRouteDialogProps = {
  readonly activeCharacterId: string;
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
};

export function ReplaceTradeRouteDialog({
  activeCharacterId,
  counterpart,
  onClose,
  queryClient,
  route,
}: ReplaceTradeRouteDialogProps): JSX.Element {
  const mutation = useMutation(
    replaceTradeRouteMutationOptions({ queryClient }),
  );

  const [quantityPerTransition, setQuantityPerTransition] = useState(
    String(route.quantityPerTransition),
  );
  const [qtyError, setQtyError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setQtyError(undefined);

    const qty = parseFloat(quantityPerTransition);
    if (quantityPerTransition === "" || Number.isNaN(qty) || qty <= 0) {
      setQtyError("Quantity must be greater than zero.");
      return;
    }

    mutation.mutate(
      {
        newRoutePayload: {
          destinationSettlementId: route.destinationSettlementId,
          originSettlementId: route.originSettlementId,
          quantityPerTransition: qty,
          resourceId: route.resourceId,
        },
        oldRouteId: route.id,
        proposingCitizenId: activeCharacterId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to replace trade route.");
        },
        onSuccess: () => {
          notifyMutationSuccess(
            "Trade route replaced. New proposal pending approval.",
          );
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Replace trade route</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Replace the route with{" "}
            <span className="font-medium text-foreground">{counterpart}</span>.
            A new proposal will be created pending approval.
          </DialogDescription>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Resource</span>
              <p className="text-sm">{route.resourceName}</p>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                New quantity per turn
              </span>
              <Input
                aria-invalid={qtyError !== undefined}
                aria-label="New quantity per turn"
                disabled={mutation.isPending}
                inputMode="numeric"
                value={quantityPerTransition}
                onChange={(e) => {
                  setQuantityPerTransition(e.currentTarget.value);
                }}
              />
              {qtyError !== undefined ? (
                <p className="text-xs text-destructive">{qtyError}</p>
              ) : null}
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              Replace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
