import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Minus, Pencil } from "lucide-react";
import { useState, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type TurnTransitionOutcome } from "@/features/turns";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { parseDepositDepletedPayload } from "@/shared/simulation";

import { restoreDepositInstanceMutationOptions } from "../../mutations/restoreDepositInstanceMutations";

import { EditResourceQuantitiesDialog } from "./EditResourceQuantitiesDialog";
import { HardDeleteDepositConfirmDialog } from "./HardDeleteDepositConfirmDialog";
import { MaxWorkersEditDialog } from "./MaxWorkersEditDialog";
import { ExhaustDepositConfirmDialog } from "./RemoveDepositConfirmDialog";

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
  const [showEditQuantities, setShowEditQuantities] = useState(false);
  const [showMaxWorkersEdit, setShowMaxWorkersEdit] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showHardDeleteConfirm, setShowHardDeleteConfirm] = useState(false);

  const restoreMutation = useMutation(
    restoreDepositInstanceMutationOptions({ queryClient }),
  );

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
      <TableRow>
        <TableCell className="py-2 pr-4 font-medium">
          <span className="flex items-center gap-2">
            {instance.name}
            {isDepletion ? (
              depletedTooltip !== undefined ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge aria-label="Depleted" variant="secondary">
                      Depleted
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{depletedTooltip}</TooltipContent>
                </Tooltip>
              ) : (
                <Badge aria-label="Depleted" variant="secondary">
                  Depleted
                </Badge>
              )
            ) : null}
          </span>
        </TableCell>
        <TableCell className="py-2 pr-4 text-muted-foreground">
          {instance.depositTypeName}
        </TableCell>
        <TableCell className="py-2 pr-4 text-muted-foreground text-xs">
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
        </TableCell>
        <TableCell className="py-2 pr-4">
          <span className="text-sm">{workersDisplay}</span>
        </TableCell>
        {canAdmin || canManage ? (
          <TableCell className="w-[18rem] py-2 text-right">
            <div className="flex items-center justify-end gap-2">
              {instance.status === "removed" ? (
                canAdmin ? (
                  <>
                    <Button
                      aria-label={`Restore ${instance.name}`}
                      disabled={restoreMutation.isPending}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        restoreMutation.mutate(
                          { depositInstanceId: instance.id },
                          {
                            onSuccess: () => {
                              notifyMutationSuccess(
                                `${instance.name} restored.`,
                              );
                            },
                            onError: (error) => {
                              notifyMutationError(
                                error,
                                "Failed to restore deposit instance.",
                              );
                            },
                          },
                        );
                      }}
                    >
                      Restore
                    </Button>
                    <Button
                      aria-label={`Permanently delete ${instance.name}`}
                      size="sm"
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setShowHardDeleteConfirm(true);
                      }}
                    >
                      Delete permanently
                    </Button>
                  </>
                ) : null
              ) : (
                <>
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
                  {canAdmin && instance.resources.length > 0 ? (
                    <Button
                      aria-label={`Edit resource quantities for ${instance.name}`}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowEditQuantities(true);
                      }}
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      Qtys
                    </Button>
                  ) : null}
                  {canAdmin ? (
                    assignedCount > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label={`Exhaust ${instance.name}`}
                            disabled
                            size="sm"
                            type="button"
                            variant="destructive"
                          >
                            Exhaust
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Cannot exhaust: deposit has assigned workers.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        aria-label={`Exhaust ${instance.name}`}
                        size="sm"
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          setShowRemoveConfirm(true);
                        }}
                      >
                        Exhaust
                      </Button>
                    )
                  ) : null}
                </>
              )}
            </div>
          </TableCell>
        ) : null}
      </TableRow>
      {showEditQuantities ? (
        <EditResourceQuantitiesDialog
          instance={instance}
          queryClient={queryClient}
          settlementId={settlementId}
          onClose={() => {
            setShowEditQuantities(false);
          }}
        />
      ) : null}
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
        <ExhaustDepositConfirmDialog
          instance={instance}
          queryClient={queryClient}
          onClose={() => {
            setShowRemoveConfirm(false);
          }}
        />
      ) : null}
      {showHardDeleteConfirm ? (
        <HardDeleteDepositConfirmDialog
          instance={instance}
          queryClient={queryClient}
          onClose={() => {
            setShowHardDeleteConfirm(false);
          }}
        />
      ) : null}
    </>
  );
}
