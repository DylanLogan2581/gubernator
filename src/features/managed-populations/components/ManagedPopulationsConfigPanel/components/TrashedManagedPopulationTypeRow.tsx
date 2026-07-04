import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";

import {
  hardDeleteManagedPopulationTypeMutationOptions,
  restoreManagedPopulationTypeMutationOptions,
} from "../../../mutations/managedPopulationsMutations";

import type { ManagedPopulationType } from "../../../types/managedPopulationTypes";
import type { QueryClient } from "@tanstack/react-query";

export function TrashedManagedPopulationTypeRow({
  populationType,
  queryClient,
  worldId,
}: {
  readonly populationType: ManagedPopulationType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const [hardDeleteConfirmOpen, setHardDeleteConfirmOpen] = useState(false);
  const restoreMutation = useRestoreRow(
    restoreManagedPopulationTypeMutationOptions({ queryClient }),
    { successMessage: "Managed population type restored." },
  );
  const hardDeleteMutation = useHardDeleteRow(
    hardDeleteManagedPopulationTypeMutationOptions({ queryClient }),
    { successMessage: "Managed population type permanently deleted." },
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{populationType.name}</span>
          <Badge variant="outline">trashed</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {(populationType.growthRate * 100).toFixed(1)}% growth
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            restoreMutation.mutate({
              managedPopulationTypeId: populationType.id,
              worldId,
            });
          }}
        >
          Restore
        </Button>
        {populationType.hasActiveReferences ? (
          <span title="Cannot permanently delete: this population type is referenced by active job configurations.">
            <Button type="button" variant="destructive" size="sm" disabled>
              Delete permanently
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setHardDeleteConfirmOpen(true);
            }}
          >
            Delete permanently
          </Button>
        )}
      </div>
      {hardDeleteConfirmOpen ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setHardDeleteConfirmOpen(false);
          }}
          title={`Permanently delete ${populationType.name}?`}
          description={
            <>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {populationType.name}
              </span>{" "}
              and all its data. This action cannot be undone.
            </>
          }
          confirmLabel="Delete permanently"
          isPending={hardDeleteMutation.isPending}
          onConfirm={() => {
            hardDeleteMutation.mutate({
              managedPopulationTypeId: populationType.id,
              worldId,
            });
          }}
        />
      ) : null}
    </div>
  );
}
