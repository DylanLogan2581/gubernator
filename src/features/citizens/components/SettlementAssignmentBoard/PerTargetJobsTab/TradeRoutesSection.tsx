import { useMutation } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type TradeRoute, type TradeRouteLeg } from "@/features/trade";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setPerTargetBulkAssignmentMutationOptions } from "../../../mutations/perTargetBulkAssignmentMutations";

import { CollapsibleSection } from "./Shared";

import type { QueryClient } from "@tanstack/react-query";

type TradeRoutesSectionProps = {
  readonly canEdit: boolean;
  readonly countByTradeRouteEnd: ReadonlyMap<string, number>;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly tradeRoutes: readonly TradeRoute[];
  readonly unassignedNpcCount: number;
};

export function TradeRoutesSection({
  canEdit,
  countByTradeRouteEnd,
  queryClient,
  settlementId,
  tradeRoutes,
  unassignedNpcCount,
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
                canEdit={canEdit}
                currentCount={countByTradeRouteEnd.get(localKey) ?? 0}
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
                unassignedNpcCount={unassignedNpcCount}
              />
              <TradeRouteRemoteEndRow
                assignedCount={countByTradeRouteEnd.get(remoteKey) ?? 0}
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
  canEdit,
  currentCount,
  icon,
  label,
  queryClient,
  routeId,
  settlementId,
  tradeRouteEnd,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly queryClient: QueryClient;
  readonly routeId: string;
  readonly settlementId: string;
  readonly tradeRouteEnd: "destination" | "origin";
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const [localCount, setLocalCount] = useState(String(currentCount));
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient }),
  );

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== currentCount;
  const isRaising = isValid && parsedCount > currentCount;
  const noNpcs = isRaising && unassignedNpcCount === 0;
  const applyDisabled = mutation.isPending || !isDirty || noNpcs;
  const applyTooltip = noNpcs ? "No unassigned NPCs available" : undefined;

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        assignmentType: "trade_route",
        settlementId,
        targetCount: parsedCount,
        targetId: routeId,
        tradeRouteEnd,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Trade route assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update trade route assignment.");
    }
  }

  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-medium">{label}</span>
          <span className="tabular-nums text-xs text-muted-foreground">
            {currentCount} / <span aria-label="no upper bound">∞</span>
          </span>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Target count for ${label}`}
              className="w-20"
              disabled={mutation.isPending}
              inputMode="numeric"
              min="0"
              type="number"
              value={localCount}
              onChange={(e) => {
                setLocalCount(e.currentTarget.value);
              }}
            />
            <span title={applyTooltip}>
              <Button
                disabled={applyDisabled}
                size="sm"
                type="button"
                onClick={() => {
                  void handleApply();
                }}
              >
                Apply
              </Button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
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
