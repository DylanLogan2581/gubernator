import { useMutation, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {instance.name}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently remove{" "}
          <span className="font-medium text-foreground">{instance.name}</span>.
          This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
