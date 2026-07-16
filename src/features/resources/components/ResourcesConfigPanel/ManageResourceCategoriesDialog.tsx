import { type JSX } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResourceCategoriesConfigPanel } from "@/features/resourceCategories";

type ManageResourceCategoriesDialogProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly onClose: () => void;
  readonly worldId: string;
};

export function ManageResourceCategoriesDialog({
  canAdmin,
  isArchived,
  onClose,
  worldId,
}: ManageResourceCategoriesDialogProps): JSX.Element {
  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Manage resource categories</DialogTitle>
        </DialogHeader>
        <div className="pr-9">
          <ResourceCategoriesConfigPanel
            canAdmin={canAdmin}
            isArchived={isArchived}
            worldId={worldId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
