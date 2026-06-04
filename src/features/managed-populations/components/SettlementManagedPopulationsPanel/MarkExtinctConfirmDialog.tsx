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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {instance.name} extinct?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will mark{" "}
          <span className="font-medium text-foreground">{instance.name}</span>{" "}
          as extinct. This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="outline"
            onClick={onClose}
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
            Mark extinct
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
