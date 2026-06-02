import { useMutation } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { type TradeRoute } from "@/features/trade";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setPerTargetAssignmentMutationOptions } from "../../../mutations/perTargetAssignmentMutations";

import { AssignDialog } from "./AssignDialog";
import { CitizenTags, CollapsibleSection, TargetRowShell } from "./Shared";

import type { Citizen } from "../../../types/citizenTypes";
import type { QueryClient } from "@tanstack/react-query";

type TradeRoutesSectionProps = {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedByTradeRouteEnd: ReadonlyMap<string, readonly string[]>;
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly tradeRoutes: readonly TradeRoute[];
};

export function TradeRoutesSection({
  aliveCitizens,
  assignedByTradeRouteEnd,
  canEdit,
  citizenMap,
  queryClient,
  settlementId,
  tradeRoutes,
}: TradeRoutesSectionProps): JSX.Element {
  return (
    <CollapsibleSection title="Trade routes">
      {tradeRoutes.length === 0 ? (
        <EmptyState
          title="No active trade routes"
          description="This settlement has no active trade routes."
        />
      ) : (
        tradeRoutes.map((route) => {
          const localEnd =
            route.originSettlementId === settlementId
              ? "origin"
              : "destination";
          const remoteEnd = localEnd === "origin" ? "destination" : "origin";
          const remoteSettlementName =
            localEnd === "origin"
              ? route.destinationSettlementName
              : route.originSettlementName;
          const localLabel =
            localEnd === "origin"
              ? `${route.resourceName} → ${route.destinationSettlementName} — Trader (origin)`
              : `${route.originSettlementName} → ${route.resourceName} — Trader (destination)`;
          const localKey = `${route.id}:${localEnd}`;
          const remoteKey = `${route.id}:${remoteEnd}`;

          return (
            <div key={route.id} className="grid gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {route.resourceName}: {route.originSettlementName} →{" "}
                {route.destinationSettlementName}
              </p>
              <TradeRouteLocalEndRow
                aliveCitizens={aliveCitizens}
                assignedIds={assignedByTradeRouteEnd.get(localKey) ?? []}
                canEdit={canEdit}
                citizenMap={citizenMap}
                label={localLabel}
                queryClient={queryClient}
                routeId={route.id}
                settlementId={settlementId}
                tradeRouteEnd={localEnd}
              />
              <TradeRouteRemoteEndRow
                assignedCount={
                  (assignedByTradeRouteEnd.get(remoteKey) ?? []).length
                }
                remoteSettlementName={remoteSettlementName}
                tradeRouteEnd={remoteEnd}
              />
            </div>
          );
        })
      )}
    </CollapsibleSection>
  );
}

function TradeRouteLocalEndRow({
  aliveCitizens,
  assignedIds,
  canEdit,
  citizenMap,
  label,
  queryClient,
  routeId,
  settlementId,
  tradeRouteEnd,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedIds: readonly string[];
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly label: string;
  readonly queryClient: QueryClient;
  readonly routeId: string;
  readonly settlementId: string;
  readonly tradeRouteEnd: "destination" | "origin";
}): JSX.Element {
  const [showDialog, setShowDialog] = useState(false);
  const mutation = useMutation(
    setPerTargetAssignmentMutationOptions({ queryClient }),
  );

  const capacityHint = `${assignedIds.length.toString()} assigned`;

  async function handleAssign(citizenIds: string[]): Promise<void> {
    try {
      await mutation.mutateAsync({
        assignmentType: "trade_route",
        citizenIds,
        settlementId,
        targetId: routeId,
        tradeRouteEnd,
      });
      setShowDialog(false);
      notifyMutationSuccess("Trade route assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update trade route assignment.");
    }
  }

  function handleRemove(citizenId: string): void {
    const newIds = assignedIds.filter((id) => id !== citizenId);
    void mutation
      .mutateAsync({
        assignmentType: "trade_route",
        citizenIds: newIds,
        settlementId,
        targetId: routeId,
        tradeRouteEnd,
      })
      .then(() => {
        notifyMutationSuccess("Trade route assignment updated.");
      })
      .catch((error: unknown) => {
        notifyMutationError(error, "Failed to update trade route assignment.");
      });
  }

  return (
    <>
      <TargetRowShell
        assignButton={
          canEdit ? (
            <Button
              disabled={mutation.isPending}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setShowDialog(true);
              }}
            >
              Assign citizens
            </Button>
          ) : undefined
        }
        capacityHint={capacityHint}
        label={label}
      >
        <CitizenTags
          assignedIds={assignedIds}
          canEdit={canEdit}
          citizenMap={citizenMap}
          isPending={mutation.isPending}
          labelPrefix={label}
          onRemove={handleRemove}
        />
      </TargetRowShell>
      {showDialog ? (
        <AssignDialog
          aliveCitizens={aliveCitizens}
          currentCitizenIds={assignedIds}
          isPending={mutation.isPending}
          title={`Assign traders — ${label}`}
          onClose={() => {
            setShowDialog(false);
          }}
          onSubmit={(ids) => {
            void handleAssign(ids);
          }}
        />
      ) : null}
    </>
  );
}

function TradeRouteRemoteEndRow({
  assignedCount,
  remoteSettlementName,
  tradeRouteEnd,
}: {
  readonly assignedCount: number;
  readonly remoteSettlementName: string;
  readonly tradeRouteEnd: "destination" | "origin";
}): JSX.Element {
  const endLabel = tradeRouteEnd === "origin" ? "Origin" : "Destination";
  return (
    <div className="rounded border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <span className="font-medium">
        {endLabel}: {remoteSettlementName} — Trader
      </span>
      <span className="ml-2 text-xs">
        {assignedCount.toString()} assigned (remote)
      </span>
    </div>
  );
}
