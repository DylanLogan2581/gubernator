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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete {instance.name}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently delete{" "}
          <span className="font-medium text-foreground">{instance.name}</span>{" "}
          and all its data. This action cannot be undone.
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
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
