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

import type { ReligionUsage } from "../../queries/religionsQueries";
import type { Religion } from "../../types/religionTypes";

type DeleteReligionDialogProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly religion: Religion;
  readonly worldId: string;
};

type DeleteReligionDialogBodyProps = {
  readonly isReassignDisabled: boolean;
  readonly otherReligions: readonly Religion[];
  readonly reassignToId: string | null;
  readonly religion: Religion;
  readonly setReassignToId: (id: string | null) => void;
  readonly usageQuery: {
    readonly data: ReligionUsage | undefined;
    readonly isError: boolean;
    readonly isPending: boolean;
  };
};

function DeleteReligionDialogBody({
  isReassignDisabled,
  otherReligions,
  reassignToId,
  religion,
  setReassignToId,
  usageQuery,
}: DeleteReligionDialogBodyProps): JSX.Element {
  if (usageQuery.isPending) {
    return <p className="text-muted-foreground">Checking usage…</p>;
  }
  if (usageQuery.isError) {
    return (
      <p className="text-muted-foreground">Usage counts could not be loaded.</p>
    );
  }

  const usage = usageQuery.data;
  const hasReferences =
    usage !== undefined && (usage.citizenCount > 0 || usage.nationCount > 0);

  if (!hasReferences) {
    return (
      <p className="text-muted-foreground">
        Delete "{religion.name}"? Nothing references it.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground">
        {usage.citizenCount} citizen{usage.citizenCount === 1 ? "" : "s"} and{" "}
        {usage.nationCount} nation{usage.nationCount === 1 ? "" : "s"} currently
        reference "{religion.name}".
      </p>
      {otherReligions.length > 0 ? (
        <Label className="grid gap-1">
          <span className="text-muted-foreground">
            What should happen to those references?
          </span>
          <NativeSelect
            aria-label="Reassign references to"
            disabled={isReassignDisabled}
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
          References will be cleared — no other religions exist in this world to
          reassign to.
        </p>
      )}
    </>
  );
}

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
          <DeleteReligionDialogBody
            isReassignDisabled={deleteMutation.isPending}
            otherReligions={otherReligions}
            reassignToId={reassignToId}
            religion={religion}
            setReassignToId={setReassignToId}
            usageQuery={usageQuery}
          />
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
