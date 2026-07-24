import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { removeManagedPopulationInstanceMutationOptions } from "../../mutations/removeManagedPopulationInstanceMutations";

import type { ManagedPopulationInstance } from "../../types/managedPopulationInstanceTypes";

type MarkExtinctConfirmDialogProps = {
  readonly instance: ManagedPopulationInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
};

export function MarkExtinctConfirmDialog({
  instance,
  onClose,
  queryClient,
}: MarkExtinctConfirmDialogProps): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title={`Mark ${instance.name} extinct?`}
      description={
        <>
          This will mark{" "}
          <span className="font-medium text-foreground">{instance.name}</span>{" "}
          as extinct. This action cannot be undone.
        </>
      }
      confirmLabel="Mark extinct"
      mutationOptions={removeManagedPopulationInstanceMutationOptions({
        queryClient,
      })}
      input={{ managedPopulationInstanceId: instance.id }}
      successMessage={`${instance.name} marked extinct.`}
      errorFallback="Failed to mark population extinct."
    />
  );
}
