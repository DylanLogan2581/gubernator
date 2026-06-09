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

import { hardDeleteConstructionProjectMutationOptions } from "../../mutations/hardDeleteConstructionProjectMutations";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function DestroyConfirmDialog({
  onClose,
  project,
  queryClient,
  settlementId,
}: {
  readonly onClose: () => void;
  readonly project: ConstructionProject;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const destroyMutation = useMutation(
    hardDeleteConstructionProjectMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await destroyMutation.mutateAsync({
        projectId: project.id,
      });
      notifyMutationSuccess("Construction project destroyed.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to destroy construction project.");
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
          <DialogTitle>
            Permanently destroy {project.blueprintName}?
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently delete the cancelled construction of{" "}
          <span className="font-medium text-foreground">
            {project.blueprintName}
          </span>{" "}
          (Tier {project.tierNumber}). This cannot be undone, and no resources
          will be refunded.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={destroyMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Keep
          </Button>
          <Button
            disabled={destroyMutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Destroy permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
