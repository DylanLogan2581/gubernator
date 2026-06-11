import { Trash2 } from "lucide-react";


import { Button } from "@/components/ui/button";
import { type JobDefinition } from "@/features/jobs";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";

import { softDeleteDepositTypeMutationOptions } from "../../mutations/depositsMutations";

import type { DepositType } from "../../types/depositTypes";
import type { QueryClient } from "@tanstack/react-query";
import type { JSX } from "react";

export function DepositTypeRow({
  depositType,
  canEdit,
  depositJobs,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly depositType: DepositType;
  readonly canEdit: boolean;
  readonly depositJobs: readonly JobDefinition[];
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const linkedJob = depositJobs.find((j) => j.id === depositType.jobId);
  const softDeleteMutation = useSoftDeleteRow(
    softDeleteDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type moved to trash." },
  );

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{depositType.name}</span>
        <span className="text-xs text-muted-foreground">
          {depositType.outputUnitsPerWorker.toLocaleString()} output/worker
          {linkedJob !== undefined ? ` · ${linkedJob.name}` : null}
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
            aria-label={`Move ${depositType.name} to trash`}
            title="Move to trash"
            disabled={softDeleteMutation.isPending}
            onClick={() => {
              softDeleteMutation.mutate({
                depositTypeId: depositType.id,
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
