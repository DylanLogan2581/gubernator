import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { hardDeleteSettlementBuildingMutationOptions } from "../../mutations/settlementBuildingsMutations";

import type { SettlementBuilding } from "../../types/settlementBuildingTypes";

type HardDeleteSettlementBuildingDialogProps = {
  readonly building: SettlementBuilding;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function HardDeleteSettlementBuildingDialog({
  building,
  onClose,
  queryClient,
  settlementId,
  worldId,
}: HardDeleteSettlementBuildingDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title={`Permanently delete ${building.blueprintName}?`}
      description={
        <>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}). This action cannot be undone.
        </>
      }
      confirmLabel="Delete"
      mutationOptions={hardDeleteSettlementBuildingMutationOptions({
        queryClient,
        settlementId,
      })}
      input={{ settlementBuildingId: building.id, worldId }}
      successMessage="Building permanently deleted."
      errorFallback="Failed to delete building."
    />
  );
}
