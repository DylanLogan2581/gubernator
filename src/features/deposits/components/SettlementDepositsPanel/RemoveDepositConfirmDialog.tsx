import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { removeDepositInstanceMutationOptions } from "../../mutations/removeDepositInstanceMutations";

import type { DepositInstance } from "../../types/depositInstanceTypes";

type RemoveDepositConfirmDialogProps = {
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
};

export function RemoveDepositConfirmDialog({
  instance,
  onClose,
  queryClient,
}: RemoveDepositConfirmDialogProps): JSX.Element {
  const mutation = useMutation(
    removeDepositInstanceMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await mutation.mutateAsync({ depositInstanceId: instance.id });
      notifyMutationSuccess(`${instance.name} removed.`);
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to remove deposit instance.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Remove ${instance.name}?`}
      description={
        <>
          This will permanently remove{" "}
          <span className="font-medium text-foreground">{instance.name}</span>.
          This action cannot be undone.
        </>
      }
      confirmLabel="Remove"
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
