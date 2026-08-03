import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { manualDeconstructBuildingMutationOptions } from "../../mutations/settlementBuildingsMutations";

import type { SettlementBuilding } from "../../types/settlementBuildingTypes";

type DeconstructConfirmDialogProps = {
  readonly building: SettlementBuilding;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
};

export function DeconstructConfirmDialog({
  building,
  onClose,
  queryClient,
  settlementId,
}: DeconstructConfirmDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title={`Deconstruct ${building.blueprintName}?`}
      description={
        <>
          This will permanently deconstruct{" "}
          <span className="font-medium text-foreground">
            {building.blueprintName}
          </span>{" "}
          (Tier {building.tierNumber}). This action cannot be undone.
        </>
      }
      confirmLabel="Deconstruct"
      mutationOptions={manualDeconstructBuildingMutationOptions({
        queryClient,
        settlementId,
      })}
      input={{ settlementBuildingId: building.id }}
      successMessage="Building deconstructed."
      errorFallback="Failed to deconstruct building."
    />
  );
}
