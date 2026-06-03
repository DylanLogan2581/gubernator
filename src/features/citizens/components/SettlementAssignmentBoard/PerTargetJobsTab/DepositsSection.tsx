import { useMutation } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { type DepositInstance } from "@/features/deposits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setPerTargetAssignmentMutationOptions } from "../../../mutations/perTargetAssignmentMutations";

import { AssignDialog } from "./AssignDialog";
import { CitizenTags, CollapsibleSection, TargetRowShell } from "./Shared";

import type { Citizen } from "../../../types/citizenTypes";
import type { QueryClient } from "@tanstack/react-query";

type DepositsSectionProps = {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedByDeposit: ReadonlyMap<string, readonly string[]>;
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly deposits: readonly DepositInstance[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
};

export function DepositsSection({
  aliveCitizens,
  assignedByDeposit,
  canEdit,
  citizenMap,
  deposits,
  queryClient,
  settlementId,
}: DepositsSectionProps): JSX.Element {
  return (
    <CollapsibleSection title="Deposits">
      {deposits.length === 0 ? (
        <EmptyState
          title="No active deposits"
          description="This settlement has no active deposit instances."
        />
      ) : (
        deposits.map((deposit) => (
          <DepositTargetRow
            key={deposit.id}
            aliveCitizens={aliveCitizens}
            assignedIds={assignedByDeposit.get(deposit.id) ?? []}
            canEdit={canEdit}
            citizenMap={citizenMap}
            deposit={deposit}
            queryClient={queryClient}
            settlementId={settlementId}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

function DepositTargetRow({
  aliveCitizens,
  assignedIds,
  canEdit,
  citizenMap,
  deposit,
  queryClient,
  settlementId,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedIds: readonly string[];
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly deposit: DepositInstance;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [showDialog, setShowDialog] = useState(false);
  const mutation = useMutation(
    setPerTargetAssignmentMutationOptions({ queryClient }),
  );

  const label = `${deposit.name} — ${deposit.depositTypeJobName}`;
  const capacityHint =
    deposit.maxWorkers !== null
      ? `${assignedIds.length.toString()} / ${deposit.maxWorkers.toString()}`
      : `${assignedIds.length.toString()} assigned`;

  async function handleAssign(citizenIds: string[]): Promise<void> {
    try {
      await mutation.mutateAsync({
        assignmentType: "deposit",
        citizenIds,
        settlementId,
        targetId: deposit.id,
      });
      setShowDialog(false);
      notifyMutationSuccess("Deposit assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update deposit assignment.");
    }
  }

  function handleRemove(citizenId: string): void {
    const newIds = assignedIds.filter((id) => id !== citizenId);
    void mutation
      .mutateAsync({
        assignmentType: "deposit",
        citizenIds: newIds,
        settlementId,
        targetId: deposit.id,
      })
      .then(() => {
        notifyMutationSuccess("Deposit assignment updated.");
      })
      .catch((error: unknown) => {
        notifyMutationError(error, "Failed to update deposit assignment.");
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
          title={`Assign workers to ${label}`}
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
