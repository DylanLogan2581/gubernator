import { useMutation } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { type ManagedPopulationInstance } from "@/features/managed-populations";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setPerTargetAssignmentMutationOptions } from "../../../mutations/perTargetAssignmentMutations";

import { AssignDialog } from "./AssignDialog";
import { CitizenTags, CollapsibleSection, TargetRowShell } from "./Shared";

import type { Citizen } from "../../../types/citizenTypes";
import type { QueryClient } from "@tanstack/react-query";

type PopulationSectionProps = {
  readonly aliveCitizens: readonly Citizen[];
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly populations: readonly ManagedPopulationInstance[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
};

export function HusbandrySection({
  aliveCitizens,
  assignedByHusbandry,
  canEdit,
  citizenMap,
  populations,
  queryClient,
  settlementId,
}: PopulationSectionProps & {
  readonly assignedByHusbandry: ReadonlyMap<string, readonly string[]>;
}): JSX.Element {
  return (
    <CollapsibleSection title="Husbandry">
      {populations.length === 0 ? (
        <EmptyState
          title="No active populations"
          description="This settlement has no active managed population instances."
        />
      ) : (
        populations.map((pop) => (
          <PopulationTargetRow
            key={pop.id}
            aliveCitizens={aliveCitizens}
            assignedIds={assignedByHusbandry.get(pop.id) ?? []}
            assignmentType="husbandry"
            canEdit={canEdit}
            citizenMap={citizenMap}
            jobName={pop.husbandryJobName}
            population={pop}
            queryClient={queryClient}
            settlementId={settlementId}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

export function CullingSection({
  aliveCitizens,
  assignedByCulling,
  canEdit,
  citizenMap,
  populations,
  queryClient,
  settlementId,
}: PopulationSectionProps & {
  readonly assignedByCulling: ReadonlyMap<string, readonly string[]>;
}): JSX.Element {
  return (
    <CollapsibleSection title="Culling">
      {populations.length === 0 ? (
        <EmptyState
          title="No active populations"
          description="This settlement has no active managed population instances."
        />
      ) : (
        populations.map((pop) => (
          <PopulationTargetRow
            key={pop.id}
            aliveCitizens={aliveCitizens}
            assignedIds={assignedByCulling.get(pop.id) ?? []}
            assignmentType="culling"
            canEdit={canEdit}
            citizenMap={citizenMap}
            jobName={pop.cullingJobName}
            population={pop}
            queryClient={queryClient}
            settlementId={settlementId}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

function PopulationTargetRow({
  aliveCitizens,
  assignedIds,
  assignmentType,
  canEdit,
  citizenMap,
  jobName,
  population,
  queryClient,
  settlementId,
}: {
  readonly aliveCitizens: readonly Citizen[];
  readonly assignedIds: readonly string[];
  readonly assignmentType: "culling" | "husbandry";
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly jobName: string;
  readonly population: ManagedPopulationInstance;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [showDialog, setShowDialog] = useState(false);
  const mutation = useMutation(
    setPerTargetAssignmentMutationOptions({ queryClient }),
  );

  const label = `${population.name} — ${jobName}`;
  const capacityHint = `${assignedIds.length.toString()} assigned`;

  async function handleAssign(citizenIds: string[]): Promise<void> {
    try {
      await mutation.mutateAsync({
        assignmentType,
        citizenIds,
        settlementId,
        targetId: population.id,
      });
      setShowDialog(false);
      notifyMutationSuccess("Assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update assignment.");
    }
  }

  function handleRemove(citizenId: string): void {
    const newIds = assignedIds.filter((id) => id !== citizenId);
    void mutation
      .mutateAsync({
        assignmentType,
        citizenIds: newIds,
        settlementId,
        targetId: population.id,
      })
      .then(() => {
        notifyMutationSuccess("Assignment updated.");
      })
      .catch((error: unknown) => {
        notifyMutationError(error, "Failed to update assignment.");
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
