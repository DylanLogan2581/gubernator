import { useMutation } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ManagedPopulationInstance } from "@/features/managed-populations";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setPerTargetBulkAssignmentMutationOptions } from "../../../mutations/perTargetBulkAssignmentMutations";

import { CollapsibleSection } from "./Shared";

import type { QueryClient } from "@tanstack/react-query";

type PopulationSectionProps = {
  readonly canEdit: boolean;
  readonly populations: readonly ManagedPopulationInstance[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
};

export function HusbandrySection({
  canEdit,
  countByHusbandry,
  populations,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: PopulationSectionProps & {
  readonly countByHusbandry: ReadonlyMap<string, number>;
}): JSX.Element {
  return (
    <CollapsibleSection title="Husbandry">
      {populations.length === 0 ? (
        <EmptyState
          title="No active populations"
          description="This settlement has no active managed population instances."
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 font-medium" scope="col">
                Population / Job
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
            {populations.map((pop) => (
              <PopulationTargetRow
                key={pop.id}
                assignmentType="husbandry"
                canEdit={canEdit}
                currentCount={countByHusbandry.get(pop.id) ?? 0}
                jobName={pop.husbandryJobName}
                population={pop}
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

export function CullingSection({
  canEdit,
  countByCulling,
  populations,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: PopulationSectionProps & {
  readonly countByCulling: ReadonlyMap<string, number>;
}): JSX.Element {
  return (
    <CollapsibleSection title="Culling">
      {populations.length === 0 ? (
        <EmptyState
          title="No active populations"
          description="This settlement has no active managed population instances."
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 font-medium" scope="col">
                Population / Job
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
            {populations.map((pop) => (
              <PopulationTargetRow
                key={pop.id}
                assignmentType="culling"
                canEdit={canEdit}
                currentCount={countByCulling.get(pop.id) ?? 0}
                jobName={pop.cullingJobName}
                population={pop}
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

function PopulationTargetRow({
  assignmentType,
  canEdit,
  currentCount,
  jobName,
  population,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: {
  readonly assignmentType: "culling" | "husbandry";
  readonly canEdit: boolean;
  readonly currentCount: number;
  readonly jobName: string;
  readonly population: ManagedPopulationInstance;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const [localCount, setLocalCount] = useState(String(currentCount));
  const mutation = useMutation(
    setPerTargetBulkAssignmentMutationOptions({ queryClient }),
  );

  const label = `${population.name} — ${jobName}`;

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
        assignmentType,
        settlementId,
        targetCount: parsedCount,
        targetId: population.id,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update assignment.");
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-medium">{label}</td>
      <td className="py-2 pr-4 tabular-nums text-muted-foreground">
        {currentCount} / <span aria-label="no upper bound">∞</span>
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
