import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { restoreSettlementBuildingMutationOptions } from "../../mutations/settlementBuildingsMutations";

import type { SettlementBuilding } from "../../types/settlementBuildingTypes";

type RestoreSettlementBuildingDialogProps = {
  readonly building: SettlementBuilding;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function RestoreSettlementBuildingDialog({
  building,
  onClose,
  queryClient,
  settlementId,
  worldId,
}: RestoreSettlementBuildingDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title={`Restore ${building.blueprintName}?`}
      description={
        <>
          This will restore{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}) to active status.
        </>
      }
      confirmLabel="Restore"
      confirmVariant="default"
      mutationOptions={restoreSettlementBuildingMutationOptions({
        queryClient,
        settlementId,
      })}
      input={{ settlementBuildingId: building.id, worldId }}
      successMessage="Building restored."
      errorFallback="Failed to restore building."
    />
  );
}
