import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { EntityDetailsSection } from "@/components/shared/EntityDetailsSection";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationError } from "@/lib/notify";

import { updateSettlementDetailsMutationOptions } from "../../mutations/settlementsMutations";

import type { SettlementWithNation } from "../../types/settlementTypes";

export function SettlementDetailsSection({
  canEdit,
  queryClient,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const updateMutation = useMutation(
    updateSettlementDetailsMutationOptions({ queryClient }),
  );

  return (
    <EntityDetailsSection
      canEdit={canEdit}
      descriptionMaxLength={textInputLimits.settlementDescriptionMax}
      entityLabel="Settlement"
      idPrefix="settlement"
      initialDescription={settlement.description}
      initialName={settlement.name}
      isSaving={updateMutation.isPending}
      nameMaxLength={textInputLimits.settlementNameMax}
      resetMutation={() => updateMutation.reset()}
      onSave={(values, { onSuccess }) => {
        updateMutation.mutate(
          {
            description: values.description,
            name: values.name,
            nationId: settlement.nationId,
            settlementId: settlement.id,
            worldId: settlement.nation.worldId,
          },
          {
            onError: (error) => {
              notifyMutationError(error, "Failed to update settlement.");
            },
            onSuccess,
          },
        );
      }}
    />
  );
}
