import { type JSX } from "react";

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
              hardDeleteMutation.mutate({
                managedPopulationTypeId: populationType.id,
                worldId,
              });
            }}
          >
            Delete permanently
          </Button>
        )}
      </div>
    </div>
  );
}
