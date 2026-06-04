import { type QueryClient } from "@tanstack/react-query";
import { Minus } from "lucide-react";
import { useState, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TurnTransitionOutcome } from "@/features/turns";
import { parseDepositDepletedPayload } from "@/shared/simulation";

import { MaxWorkersEditDialog } from "./MaxWorkersEditDialog";
import { RemoveDepositConfirmDialog } from "./RemoveDepositConfirmDialog";

import type { DepositInstance } from "../../types/depositInstanceTypes";

function depositDepletedTooltip(
  depositId: string,
  latestOutcome: TurnTransitionOutcome | null,
): string | undefined {
  if (latestOutcome === null) return undefined;
  const entry = latestOutcome.logEntries.find(
    (e) =>
      e.logCategory === "deposit.depleted" &&
      parseDepositDepletedPayload(e.payloadJsonb)?.depositId === depositId,
  );
  if (entry === undefined) return undefined;
  return `Turn ${latestOutcome.toTurnNumber.toString()}`;
}

type DepositInstanceRowProps = {
  readonly assignedCount: number;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly instance: DepositInstance;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
};

export function DepositInstanceRow({
  assignedCount,
  canAdmin,
  canManage,
  instance,
  latestOutcome,
  queryClient,
  settlementId,
}: DepositInstanceRowProps): JSX.Element {
  const [showMaxWorkersEdit, setShowMaxWorkersEdit] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const isDepletion = instance.status === "depleted";
  const depletedTooltip = isDepletion
    ? depositDepletedTooltip(instance.id, latestOutcome)
    : undefined;

  const workersDisplay =
    instance.maxWorkers === null
      ? `${assignedCount.toString()} assigned`
      : `${assignedCount.toString()}/${instance.maxWorkers.toString()}`;

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="py-2 pr-4 font-medium">
          <span className="flex items-center gap-2">
            {instance.name}
            {isDepletion ? (
              <Badge
                aria-label="Depleted"
                title={depletedTooltip}
                variant="secondary"
              >
                Depleted
              </Badge>
            ) : null}
          </span>
        </td>
        <td className="py-2 pr-4 text-muted-foreground">
          {instance.depositTypeName}
        </td>
        <td className="py-2 pr-4 text-muted-foreground text-xs">
          {instance.resources.length === 0 ? (
            "—"
          ) : (
            <span className="flex flex-wrap gap-x-1">
              {instance.resources.map((r, idx) => {
                const text = `${r.resourceName}: ${r.remainingQuantity.toLocaleString()}/${r.initialQuantity.toLocaleString()}`;
                const isZero = isDepletion && r.remainingQuantity === 0;
                return (
                  <span key={r.id} className={isZero ? "line-through" : ""}>
                    {text}
                    {idx < instance.resources.length - 1 ? "," : ""}
                  </span>
                );
              })}
            </span>
          )}
        </td>
        <td className="py-2 pr-4">
          <span className="text-sm">{workersDisplay}</span>
        </td>
        {canAdmin || canManage ? (
          <td className="w-36 py-2 text-right">
            <div className="flex items-center justify-end gap-2">
              {canManage ? (
                <Button
                  aria-label={`Edit max workers for ${instance.name}`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowMaxWorkersEdit(true);
                  }}
                >
                  <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                  Max
                </Button>
              ) : null}
              {canAdmin ? (
                assignedCount > 0 ? (
                  <span title="Cannot remove: deposit has assigned workers.">
                    <Button
                      aria-label={`Remove ${instance.name}`}
                      disabled
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      Remove
                    </Button>
                  </span>
                ) : (
                  <Button
                    aria-label={`Remove ${instance.name}`}
                    size="sm"
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setShowRemoveConfirm(true);
                    }}
                  >
                    Remove
                  </Button>
                )
              ) : null}
            </div>
          </td>
        ) : null}
      </tr>
      {showMaxWorkersEdit ? (
        <MaxWorkersEditDialog
          assignedCount={assignedCount}
          instance={instance}
          queryClient={queryClient}
          settlementId={settlementId}
          onClose={() => {
            setShowMaxWorkersEdit(false);
          }}
        />
      ) : null}
      {showRemoveConfirm ? (
        <RemoveDepositConfirmDialog
          instance={instance}
          queryClient={queryClient}
          onClose={() => {
            setShowRemoveConfirm(false);
          }}
        />
      ) : null}
    </>
  );
}
