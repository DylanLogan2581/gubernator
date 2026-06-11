import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

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
  const mutation = useMutation(
    removeManagedPopulationInstanceMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await mutation.mutateAsync({
        managedPopulationInstanceId: instance.id,
      });
      notifyMutationSuccess(`${instance.name} marked extinct.`);
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to mark population extinct.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Mark ${instance.name} extinct?`}
      description={
        <>
          This will mark{" "}
          <span className="font-medium text-foreground">{instance.name}</span>{" "}
          as extinct. This action cannot be undone.
        </>
      }
      confirmLabel="Mark extinct"
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
