import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { EntityDetailsSection } from "@/components/shared/EntityDetailsSection";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationError } from "@/lib/notify";

import { updateNationDetailsMutationOptions } from "../../mutations/nationsMutations";

import type { Nation } from "../../types/nationTypes";

export function NationDetailsSection({
  canEdit,
  nation,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const updateMutation = useMutation(
    updateNationDetailsMutationOptions({ queryClient }),
  );

  return (
    <EntityDetailsSection
      canEdit={canEdit}
      descriptionMaxLength={textInputLimits.nationDescriptionMax}
      entityLabel="Nation"
      idPrefix="nation"
      initialDescription={nation.description}
      initialName={nation.name}
      isSaving={updateMutation.isPending}
      nameMaxLength={textInputLimits.nationNameMax}
      resetMutation={() => updateMutation.reset()}
      onSave={(values, { onSuccess }) => {
        updateMutation.mutate(
          {
            description: values.description,
            name: values.name,
            nationId: nation.id,
            worldId: nation.worldId,
          },
          {
            onError: (error) => {
              notifyMutationError(error, "Failed to update nation.");
            },
            onSuccess,
          },
        );
      }}
    />
  );
}
