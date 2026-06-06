import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  grantWorldAdminMutationOptions,
  revokeWorldAdminMutationOptions,
} from "../mutations/superadminMutations";
import {
  allWorldsForSuperadminQueryOptions,
  worldAdminsForUserQueryOptions,
} from "../queries/superadminQueries";

import type { SuperadminUser } from "../types/superadminTypes";

export type WorldAdminGrantDialogProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly targetUser: SuperadminUser;
};

export function WorldAdminGrantDialog({
  onClose,
  queryClient,
  targetUser,
}: WorldAdminGrantDialogProps): JSX.Element {
  const worldsQuery = useQuery(allWorldsForSuperadminQueryOptions());
  const worldAdminsQuery = useQuery(
    worldAdminsForUserQueryOptions(targetUser.id),
  );

  const grantMutation = useMutation(
    grantWorldAdminMutationOptions({ queryClient }),
  );
  const revokeMutation = useMutation(
    revokeWorldAdminMutationOptions({ queryClient }),
  );

  const adminWorldIds = new Set(
    worldAdminsQuery.data?.map((wa) => wa.world_id) ?? [],
  );

  const pendingWorldIds = new Set<string>([
    ...(grantMutation.isPending && grantMutation.variables !== undefined
      ? [grantMutation.variables.worldId]
      : []),
    ...(revokeMutation.isPending && revokeMutation.variables !== undefined
      ? [revokeMutation.variables.worldId]
      : []),
  ]);

  function handleToggle(worldId: string, isCurrentlyAdmin: boolean): void {
    if (isCurrentlyAdmin) {
      revokeMutation.mutate(
        { userId: targetUser.id, worldId },
        {
          onError: (error) => {
            notifyMutationError(error, "Failed to revoke world admin.");
          },
          onSuccess: () => {
            notifyMutationSuccess("World admin access revoked.");
          },
        },
      );
    } else {
      grantMutation.mutate(
        { userId: targetUser.id, worldId },
        {
          onError: (error) => {
            notifyMutationError(error, "Failed to grant world admin.");
          },
          onSuccess: () => {
            notifyMutationSuccess("World admin access granted.");
          },
        },
      );
    }
  }

  const isLoading = worldsQuery.isPending || worldAdminsQuery.isPending;
  const isError = worldsQuery.isError || worldAdminsQuery.isError;
  const errorMessage =
    getErrorDescription(worldsQuery.error) ??
    getErrorDescription(worldAdminsQuery.error);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage World Admin Access</DialogTitle>
          <DialogDescription>
            Toggle world admin access for{" "}
            <span className="font-medium">{targetUser.username}</span> (
            {targetUser.email}).
          </DialogDescription>
        </DialogHeader>

        {isLoading && <LoadingState label="Loading worlds…" />}

        {isError && (
          <ErrorState
            title="Could not load worlds"
            description={errorMessage}
          />
        )}

        {!isLoading && !isError && worldsQuery.data !== undefined && (
          <div className="flex flex-col gap-1">
            {worldsQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No worlds found.</p>
            )}
            {worldsQuery.data.map((world) => {
              const isOwner = world.owner_id === targetUser.id;
              const isAdmin = adminWorldIds.has(world.id);
              const isPending = pendingWorldIds.has(world.id);

              return (
                <div
                  key={world.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">{world.name}</span>
                  <div className="flex items-center gap-2">
                    {isOwner && (
                      <span className="text-xs text-muted-foreground">
                        Owner
                      </span>
                    )}
                    <input
                      type="checkbox"
                      checked={isAdmin}
                      disabled={isPending || isOwner}
                      onChange={() => {
                        handleToggle(world.id, isAdmin);
                      }}
                      className="h-4 w-4 cursor-pointer rounded border-border disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`World admin for ${world.name}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
