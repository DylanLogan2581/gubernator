import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { rejectTradeRouteSideMutationOptions } from "../../mutations/rejectTradeRouteSideMutations";

import type { TradeRoute } from "../../types/tradeRouteTypes";

type RejectConfirmDialogProps = {
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly rejectorCitizenId: string;
  readonly route: TradeRoute;
  readonly side: "destination" | "origin";
  readonly worldId: string;
};

export function RejectConfirmDialog({
  counterpart,
  onClose,
  queryClient,
  rejectorCitizenId,
  route,
  side,
  worldId,
}: RejectConfirmDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title="Reject trade route?"
      description={
        <>
          Reject the trade route with{" "}
          <span className="font-medium text-foreground">{counterpart}</span>?
          This cannot be undone.
        </>
      }
      confirmLabel="Reject"
      mutationOptions={rejectTradeRouteSideMutationOptions({
        queryClient,
        worldId,
      })}
      input={{
        rejectorCitizenId,
        side,
        tradeRouteId: route.id,
      }}
      successMessage="Trade route rejected."
      errorFallback="Failed to reject trade route."
    />
  );
}
