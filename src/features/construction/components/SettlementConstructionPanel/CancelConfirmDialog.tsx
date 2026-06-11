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

import { cancelConstructionProjectMutationOptions } from "../../mutations/cancelConstructionProjectMutations";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function CancelConfirmDialog({
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
  const cancelMutation = useMutation(
    cancelConstructionProjectMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      const result = await cancelMutation.mutateAsync({
        projectId: project.id,
      });
      if (result.unassignedCitizenCount > 0) {
        notifyMutationSuccess("Construction project cancelled.", {
          description: `${result.unassignedCitizenCount} citizen(s) unassigned.`,
        });
      } else {
        notifyMutationSuccess("Construction project cancelled.");
      }
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to cancel construction project.");
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
          <DialogTitle>Cancel {project.blueprintName}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will cancel the construction of{" "}
          <span className="font-medium text-foreground">
            {project.blueprintName}
          </span>{" "}
          (Tier {project.tierNumber}). Any assigned citizens will be unassigned.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={cancelMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Keep
          </Button>
          <Button
            disabled={cancelMutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Cancel project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
