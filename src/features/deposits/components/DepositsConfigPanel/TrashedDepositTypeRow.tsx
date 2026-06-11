
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";

import {
  hardDeleteDepositTypeMutationOptions,
  restoreDepositTypeMutationOptions,
} from "../../mutations/depositsMutations";

import type { DepositType } from "../../types/depositTypes";
import type { QueryClient } from "@tanstack/react-query";
import type { JSX } from "react";

export function TrashedDepositTypeRow({
  depositType,
  queryClient,
  worldId,
}: {
  readonly depositType: DepositType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useRestoreRow(
    restoreDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type restored." },
  );
  const hardDeleteMutation = useHardDeleteRow(
    hardDeleteDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type permanently deleted." },
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{depositType.name}</span>
          <Badge variant="outline">trashed</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {depositType.outputUnitsPerWorker.toLocaleString()} output/worker
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            restoreMutation.mutate({ depositTypeId: depositType.id, worldId });
          }}
        >
          Restore
        </Button>
        {depositType.hasActiveReferences ? (
          <span title="Cannot permanently delete: this deposit type is referenced by active job configurations.">
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
                depositTypeId: depositType.id,
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
