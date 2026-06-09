import { Trash2 } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import type { JobDefinition } from "@/features/jobs";
// eslint-disable-next-line import-x/no-internal-modules
import {
  softDeleteManagedPopulationTypeMutationOptions,
} from "@/features/managed-populations/mutations/managedPopulationsMutations";
// eslint-disable-next-line import-x/no-internal-modules
import type { ManagedPopulationType } from "@/features/managed-populations/types/managedPopulationTypes";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";

import type { QueryClient } from "@tanstack/react-query";

export function ManagedPopulationTypeRow({
  populationType,
  canEdit,
  cullingJobs,
  husbandryJobs,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly onEdit: () => void;
  readonly populationType: ManagedPopulationType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const husbandryJob = husbandryJobs.find(
    (j) => j.id === populationType.husbandryJobId,
  );
  const cullingJob = cullingJobs.find(
    (j) => j.id === populationType.cullingJobId,
  );
  const softDeleteMutation = useSoftDeleteRow(
    softDeleteManagedPopulationTypeMutationOptions({ queryClient }),
    { successMessage: "Managed population type moved to trash." },
  );

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{populationType.name}</span>
        <span className="text-xs text-muted-foreground">
          {(populationType.growthRate * 100).toFixed(1)}% growth ·{" "}
          {populationType.husbandryWorkersPerNAnimals.toLocaleString()}{" "}
          workers/N
          {husbandryJob !== undefined ? ` · ${husbandryJob.name}` : null}
          {cullingJob !== undefined ? ` · ${cullingJob.name}` : null}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${populationType.name} to trash`}
            title="Move to trash"
            disabled={softDeleteMutation.isPending}
            onClick={() => {
              softDeleteMutation.mutate({
                managedPopulationTypeId: populationType.id,
                worldId,
              });
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
