import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { hardDeleteDepositInstanceMutationOptions } from "../../mutations/hardDeleteDepositInstanceMutations";

import type { DepositInstance } from "../../types/depositInstanceTypes";

type HardDeleteDepositConfirmDialogProps = {
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
};

export function HardDeleteDepositConfirmDialog({
  instance,
  onClose,
  queryClient,
}: HardDeleteDepositConfirmDialogProps): JSX.Element {
  const mutation = useMutation(
    hardDeleteDepositInstanceMutationOptions({ queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await mutation.mutateAsync({ depositInstanceId: instance.id });
      notifyMutationSuccess(`${instance.name} permanently deleted.`);
      onClose();
    } catch (error) {
      notifyMutationError(
        error,
        "Failed to permanently delete deposit instance.",
      );
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Permanently delete ${instance.name}?`}
      description={
        <>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">{instance.name}</span>{" "}
          and all its data. This action cannot be undone.
        </>
      }
      confirmLabel="Delete permanently"
      isPending={mutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}
