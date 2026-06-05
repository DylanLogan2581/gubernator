import { useMutation } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DepositInstance } from "@/features/deposits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setPerTargetBulkAssignmentMutationOptions } from "../../../mutations/perTargetBulkAssignmentMutations";

import { CollapsibleSection } from "./Shared";

import type { QueryClient } from "@tanstack/react-query";

type DepositsSectionProps = {
  readonly canEdit: boolean;
  readonly countByDeposit: ReadonlyMap<string, number>;
  readonly deposits: readonly DepositInstance[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
};

export function DepositsSection({
  canEdit,
  countByDeposit,
  deposits,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: DepositsSectionProps): JSX.Element {
  return (
    <CollapsibleSection title="Deposits">
      {deposits.length === 0 ? (
        <EmptyState
          title="No active deposits"
          description="This settlement has no active deposit instances."
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 font-medium" scope="col">
                Deposit / Job
              </th>
              <th className="pb-2 font-medium" scope="col">
                Assigned / Capacity
              </th>
              {canEdit ? (
                <th className="pb-2 font-medium" scope="col">
                  Set count
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {deposits.map((deposit) => (
              <DepositTargetRow
                key={deposit.id}
                canEdit={canEdit}
                currentCount={countByDeposit.get(deposit.id) ?? 0}
                deposit={deposit}
                queryClient={queryClient}
                settlementId={settlementId}
                unassignedNpcCount={unassignedNpcCount}
              />
            ))}
          </tbody>
        </table>
      )}
    </CollapsibleSection>
  );
}

function DepositTargetRow({
  canEdit,
  currentCount,
  deposit,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: {
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly deposit: DepositInstance;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const [localCount, setLocalCount] = useState(String(currentCount));
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient }),
  );

  const label = `${deposit.name} — ${deposit.depositTypeJobName}`;
  const capacity = deposit.maxWorkers;
  const capacityDisplay =
    capacity !== null ? (
      capacity.toString()
    ) : (
      <span aria-label="no upper bound">∞</span>
    );

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== currentCount;
  const isRaising = isValid && parsedCount > currentCount;
  const atCapacity = capacity !== null && isValid && parsedCount > capacity;
  const noNpcs = isRaising && unassignedNpcCount === 0;
  const applyDisabled = mutation.isPending || !isDirty || atCapacity || noNpcs;

  const applyTooltip = atCapacity
    ? `Maximum workers for this deposit is ${capacity.toString()}`
    : noNpcs
      ? "No unassigned NPCs available"
      : undefined;

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await mutation.mutateAsync({
        assignmentType: "deposit",
        settlementId,
        targetCount: parsedCount,
        targetId: deposit.id,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Deposit assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update deposit assignment.");
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium">{label}</td>
      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
        {currentCount} / {capacityDisplay}
      </td>
      {canEdit ? (
        <td className="py-2">
          <div className="flex flex-wrap items-center gap-2">
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
        </td>
      ) : null}
    </tr>
  );
}
