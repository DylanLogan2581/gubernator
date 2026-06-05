import { useMutation } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { type TradeRoute, type TradeRouteLeg } from "@/features/trade";
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
          const resourcesLabel = legsLabel(route.legs);
          const localLabel =
            localEnd === "origin"
              ? `Trader: ${resourcesLabel} → ${route.destinationSettlementName}`
              : `Trader: ${resourcesLabel} from ${route.originSettlementName}`;
          const localTooltip =
            localEnd === "origin"
              ? `Trading ${resourcesLabel} with ${route.destinationSettlementName}`
              : `Trading ${resourcesLabel} with ${route.originSettlementName}`;
          const LocalIcon =
            localEnd === "origin" ? ArrowUpFromLine : ArrowDownToLine;
          const localKey = `${route.id}:${localEnd}`;
          const remoteKey = `${route.id}:${remoteEnd}`;

          return (
            <div key={route.id} className="grid gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {route.originSettlementName} → {route.destinationSettlementName}
                {route.legs.length > 0 ? ` (${resourcesLabel})` : null}
              </p>
              <TradeRouteLocalEndRow
                aliveCitizens={aliveCitizens}
                assignedIds={assignedByTradeRouteEnd.get(localKey) ?? []}
                canEdit={canEdit}
                citizenMap={citizenMap}
                icon={
                  <span title={localTooltip}>
                    <LocalIcon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  </span>
                }
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
                destinationSettlementName={route.destinationSettlementName}
                originSettlementName={route.originSettlementName}
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
  icon,
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
  readonly icon?: ReactNode;
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
        icon={icon}
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

function legsLabel(legs: readonly TradeRouteLeg[]): string {
  if (legs.length === 0) return "No resources";
  return legs.map((l) => l.resourceName).join(", ");
}

function TradeRouteRemoteEndRow({
  assignedCount,
  destinationSettlementName,
  originSettlementName,
  remoteSettlementName,
  tradeRouteEnd,
}: {
  readonly assignedCount: number;
  readonly destinationSettlementName: string;
  readonly originSettlementName: string;
  readonly remoteSettlementName: string;
  readonly tradeRouteEnd: "destination" | "origin";
}): JSX.Element {
  const isSending = tradeRouteEnd === "origin";
  const RemoteIcon = isSending ? ArrowUpFromLine : ArrowDownToLine;
  const remoteTooltip = isSending
    ? `Sending to ${destinationSettlementName}`
    : `Receiving from ${originSettlementName}`;
  const endLabel = isSending
    ? "Trader (sending — remote)"
    : "Trader (receiving — remote)";
  return (
    <div className="rounded border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span title={remoteTooltip}>
          <RemoteIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        </span>
        {endLabel}: {remoteSettlementName}
      </span>
      <span className="ml-2 text-xs">
        {assignedCount.toString()} assigned (remote)
      </span>
    </div>
  );
}
