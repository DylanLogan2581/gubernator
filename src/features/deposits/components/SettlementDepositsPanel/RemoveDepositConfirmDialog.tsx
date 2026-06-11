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

export function ExhaustDepositConfirmDialog({
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
      notifyMutationSuccess(`${instance.name} exhausted.`);
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to exhaust deposit instance.");
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Exhaust ${instance.name}?`}
      description={
        <>
          This will permanently exhaust{" "}
          <span className="font-medium text-foreground">{instance.name}</span>.
          All assigned workers will be unassigned. This action cannot be undone.
        </>
      }
      confirmLabel="Exhaust"
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
