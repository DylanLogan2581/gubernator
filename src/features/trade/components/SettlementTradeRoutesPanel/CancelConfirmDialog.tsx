import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { cancelTradeRouteMutationOptions } from "../../mutations/cancelTradeRouteMutations";

import type { TradeRoute } from "../../types/tradeRouteTypes";

type CancelConfirmDialogProps = {
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
  readonly traderCount: number;
  readonly worldId: string;
};

export function CancelConfirmDialog({
  counterpart,
  onClose,
  queryClient,
  route,
  traderCount,
  worldId,
}: CancelConfirmDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title="Cancel trade route?"
      description={
        <>
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
        </>
      }
      confirmLabel="Cancel route"
      mutationOptions={cancelTradeRouteMutationOptions({
        queryClient,
        worldId,
      })}
      input={{ tradeRouteId: route.id }}
      successMessage={
        traderCount > 0
          ? `Trade route cancelled. ${traderCount.toString()} ${traderCount === 1 ? "trader was" : "traders were"} unassigned.`
          : "Trade route cancelled."
      }
      errorFallback="Failed to cancel trade route."
    />
  );
}
