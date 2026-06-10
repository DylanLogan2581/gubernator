import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState, type ChangeEvent, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  adminClearUserActivePlayerCharacterMutationOptions,
  adminSetUserActivePlayerCharacterMutationOptions,
} from "../mutations/adminActivePlayerCharacterMutations";
import {
  adminUserActivePlayerCharacterRowsQueryOptions,
  adminUserLivingPlayerCharactersQueryOptions,
  allWorldsForSuperadminQueryOptions,
} from "../queries/superadminQueries";

import type { SuperadminUser } from "../types/superadminTypes";

export type ActivePlayerCharacterAdminDialogProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly targetUser: SuperadminUser;
};

export function ActivePlayerCharacterAdminDialog({
  onClose,
  queryClient,
  targetUser,
}: ActivePlayerCharacterAdminDialogProps): JSX.Element {
  const worldsQuery = useQuery(allWorldsForSuperadminQueryOptions());
  const livingPCsQuery = useQuery(
    adminUserLivingPlayerCharactersQueryOptions(targetUser.id),
  );
  const activeRowsQuery = useQuery(
    adminUserActivePlayerCharacterRowsQueryOptions(targetUser.id),
  );

  const setMutation = useMutation(
    adminSetUserActivePlayerCharacterMutationOptions({ queryClient }),
  );
  const clearMutation = useMutation(
    adminClearUserActivePlayerCharacterMutationOptions({ queryClient }),
  );

  const [selectedCitizenIds, setSelectedCitizenIds] = useState<
    Record<string, string>
  >({});

  const isLoading =
    worldsQuery.isPending ||
    livingPCsQuery.isPending ||
    activeRowsQuery.isPending;
  const isError =
    worldsQuery.isError || livingPCsQuery.isError || activeRowsQuery.isError;

  // Log errors for debugging
  if (worldsQuery.error !== null && worldsQuery.error !== undefined) {
    console.error("[SuperadminDialog] Worlds query error:", worldsQuery.error);
  }
  if (livingPCsQuery.error !== null && livingPCsQuery.error !== undefined) {
    console.error(
      "[SuperadminDialog] Living PCs query error:",
      livingPCsQuery.error,
    );
  }
  if (activeRowsQuery.error !== null && activeRowsQuery.error !== undefined) {
    console.error(
      "[SuperadminDialog] Active rows query error:",
      activeRowsQuery.error,
    );
  }

  let errorMessage = "";
  if (worldsQuery.error !== null && worldsQuery.error !== undefined) {
    errorMessage = `Failed to load worlds: ${getErrorDescription(worldsQuery.error)}`;
  } else if (
    livingPCsQuery.error !== null &&
    livingPCsQuery.error !== undefined
  ) {
    errorMessage = `Failed to load player characters: ${getErrorDescription(livingPCsQuery.error)}`;
  } else if (
    activeRowsQuery.error !== null &&
    activeRowsQuery.error !== undefined
  ) {
    errorMessage = `Failed to load active character data: ${getErrorDescription(activeRowsQuery.error)}`;
  }

  // Fallback if error message is empty but isError is true
  if (isError && errorMessage === "") {
    errorMessage =
      "Couldn't load active-character data. Refresh and try again, or contact an administrator if it continues.";
  }

  const worldsById = new Map((worldsQuery.data ?? []).map((w) => [w.id, w]));

  const activeRowByWorldId = new Map(
    (activeRowsQuery.data ?? []).map((r) => [r.worldId, r]),
  );

  const pcsByWorldId = new Map<string, typeof livingPCsQuery.data>();
  for (const pc of livingPCsQuery.data ?? []) {
    const existing = pcsByWorldId.get(pc.worldId) ?? [];
    pcsByWorldId.set(pc.worldId, [...existing, pc]);
  }

  const worldIdsWithPCs = Array.from(pcsByWorldId.keys()).sort((a, b) => {
    const nameA = worldsById.get(a)?.name ?? a;
    const nameB = worldsById.get(b)?.name ?? b;
    return nameA.localeCompare(nameB);
  });

  function handleSelectChange(
    worldId: string,
    event: ChangeEvent<HTMLSelectElement>,
  ): void {
    setSelectedCitizenIds((prev) => ({
      ...prev,
      [worldId]: event.target.value,
    }));
  }

  function handleSet(worldId: string): void {
    const citizenId = selectedCitizenIds[worldId];
    if (citizenId === undefined || citizenId === "") return;
    setMutation.mutate(
      { citizenId, userId: targetUser.id, worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to set active character.");
        },
        onSuccess: () => {
          setSelectedCitizenIds((prev) => ({ ...prev, [worldId]: "" }));
          notifyMutationSuccess("Active character updated.");
        },
      },
    );
  }

  function handleClear(worldId: string): void {
    clearMutation.mutate(
      { userId: targetUser.id, worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to clear active character.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Active character cleared.");
        },
      },
    );
  }

  const isMutating = setMutation.isPending || clearMutation.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage active player character</DialogTitle>
          <DialogDescription>
            Recovery controls for{" "}
            <span className="font-medium">{targetUser.username}</span> (
            {targetUser.email}).
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>
            This is a recovery action. Only use it when the user is stuck due to
            an orphaned row or unlinked character. Changes take effect on the
            user&apos;s next session.
          </AlertDescription>
        </Alert>

        {isLoading && <LoadingState label="Loading characters…" />}

        {isError && (
          <ErrorState title="Could not load data" description={errorMessage} />
        )}

        {!isLoading && !isError && (
          <div className="flex flex-col gap-4">
            {worldIdsWithPCs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                This user has no living player characters in any world.
              </p>
            )}
            {worldIdsWithPCs.map((worldId) => {
              const world = worldsById.get(worldId);
              const worldName = world?.name ?? worldId;
              const pcs = pcsByWorldId.get(worldId) ?? [];
              const activeRow = activeRowByWorldId.get(worldId);
              const activePC = pcs.find((pc) => pc.id === activeRow?.citizenId);
              const selectedValue = selectedCitizenIds[worldId] ?? "";
              const isPendingWorld =
                isMutating &&
                ((setMutation.isPending &&
                  setMutation.variables?.worldId === worldId) ||
                  (clearMutation.isPending &&
                    clearMutation.variables?.worldId === worldId));

              return (
                <div
                  key={worldId}
                  className="rounded-md border border-border p-3"
                >
                  <p className="mb-2 text-sm font-medium">{worldName}</p>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Current active:{" "}
                    <span className="font-medium text-foreground">
                      {activePC !== undefined ? activePC.name : "None"}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <NativeSelect
                      value={selectedValue}
                      onChange={(e) => {
                        handleSelectChange(worldId, e);
                      }}
                      disabled={isPendingWorld}
                      aria-label={`Select character for ${worldName}`}
                      className="flex-1"
                    >
                      <option value="">Select a character…</option>
                      {pcs.map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPendingWorld || selectedValue === ""}
                      onClick={() => {
                        handleSet(worldId);
                      }}
                    >
                      Set
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPendingWorld || activeRow === undefined}
                      onClick={() => {
                        handleClear(worldId);
                      }}
                    >
                      Clear
                    </Button>
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
