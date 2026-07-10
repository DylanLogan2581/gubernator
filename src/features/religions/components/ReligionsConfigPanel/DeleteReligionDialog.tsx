import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { notifyMutationSuccess } from "@/lib/notify";

import { deleteReligionMutationOptions } from "../../mutations/religionsMutations";
import {
  religionsByWorldQueryOptions,
  religionUsageQueryOptions,
} from "../../queries/religionsQueries";

import type { Religion } from "../../types/religionTypes";

type DeleteReligionDialogProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly religion: Religion;
  readonly worldId: string;
};

export function DeleteReligionDialog({
  onClose,
  queryClient,
  religion,
  worldId,
}: DeleteReligionDialogProps): JSX.Element {
  const [reassignToId, setReassignToId] = useState<string | null>(null);

  const religionsQuery = useQuery(religionsByWorldQueryOptions(worldId));
  const usageQuery = useQuery(religionUsageQueryOptions(religion.id));
  const deleteMutation = useMutation(
    deleteReligionMutationOptions({ queryClient }),
  );

  const otherReligions = (religionsQuery.data ?? []).filter(
    (option) => option.id !== religion.id,
  );

  async function handleConfirm(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({
        reassignToId,
        religionId: religion.id,
        worldId,
      });
      notifyMutationSuccess("Religion deleted.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to delete religion.");
    }
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete religion</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <p className="text-muted-foreground">
            {usageQuery.isPending
              ? "Checking usage…"
              : usageQuery.isError
                ? "Usage counts could not be loaded."
                : `${usageQuery.data.citizenCount} citizen${usageQuery.data.citizenCount === 1 ? "" : "s"} and ${usageQuery.data.nationCount} nation${usageQuery.data.nationCount === 1 ? "" : "s"} currently reference "${religion.name}".`}
          </p>
          {otherReligions.length > 0 ? (
            <Label className="grid gap-1">
              <span className="text-muted-foreground">
                What should happen to those references?
              </span>
              <NativeSelect
                aria-label="Reassign references to"
                disabled={deleteMutation.isPending}
                value={reassignToId ?? ""}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setReassignToId(next === "" ? null : next);
                }}
              >
                <option value="">Clear (unassigned)</option>
                {otherReligions.map((option) => (
                  <option key={option.id} value={option.id}>
                    Reassign to {option.name}
                  </option>
                ))}
              </NativeSelect>
            </Label>
          ) : (
            <p className="text-xs text-muted-foreground">
              References will be cleared -- no other religions exist in this
              world to reassign to.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => {
              void handleConfirm();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
