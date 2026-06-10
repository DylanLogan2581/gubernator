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
import { notifyMutationSuccess, notifyMutationError } from "@/lib/notify";

import { setUserSuperAdminMutationOptions } from "../mutations/superadminMutations";

import type { SuperadminUser } from "../types/superadminTypes";

export type ToggleSuperadminDialogProps = {
  readonly currentUserId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly targetUser: SuperadminUser;
};

export function ToggleSuperadminDialog({
  currentUserId,
  onClose,
  queryClient,
  targetUser,
}: ToggleSuperadminDialogProps): JSX.Element {
  const isSelf = targetUser.id === currentUserId;
  const willGrant = !targetUser.is_super_admin;

  const mutation = useMutation(
    setUserSuperAdminMutationOptions({ queryClient }),
  );

  function handleConfirm(): void {
    mutation.mutate(
      { userId: targetUser.id, value: willGrant },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update superadmin status.");
        },
        onSuccess: () => {
          const action = willGrant ? "granted" : "removed";
          notifyMutationSuccess(
            `Superadmin ${action} for ${targetUser.username}.`,
          );
          onClose();
        },
      },
    );
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
          <DialogTitle>{willGrant ? "Grant" : "Remove"} superadmin</DialogTitle>
          <DialogDescription>
            {willGrant
              ? `Grant superadmin privileges to ${targetUser.username} (${targetUser.email})?`
              : `Remove superadmin privileges from ${targetUser.username} (${targetUser.email})?`}
          </DialogDescription>
        </DialogHeader>

        {isSelf && !willGrant && (
          <p className="text-sm text-destructive">
            You are removing your own superadmin privileges. Make sure at least
            one other active superadmin exists before proceeding.
          </p>
        )}

        {!willGrant && (
          <p className="text-sm text-muted-foreground">
            This user will lose all superadmin capabilities immediately. This
            action cannot be undone if they are the last superadmin.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={willGrant ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Updating…"
              : willGrant
                ? "Grant superadmin"
                : "Remove superadmin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
