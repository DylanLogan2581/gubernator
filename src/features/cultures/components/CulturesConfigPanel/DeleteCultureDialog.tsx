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

import { deleteCultureMutationOptions } from "../../mutations/culturesMutations";
import {
  culturesByWorldQueryOptions,
  cultureUsageQueryOptions,
} from "../../queries/culturesQueries";

import type { CultureUsage } from "../../queries/culturesQueries";
import type { Culture } from "../../types/cultureTypes";

type DeleteCultureDialogProps = {
  readonly culture: Culture;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

type DeleteCultureDialogBodyProps = {
  readonly culture: Culture;
  readonly isReassignDisabled: boolean;
  readonly otherCultures: readonly Culture[];
  readonly reassignToId: string | null;
  readonly setReassignToId: (id: string | null) => void;
  readonly usageQuery: {
    readonly data: CultureUsage | undefined;
    readonly isError: boolean;
    readonly isPending: boolean;
  };
};

function DeleteCultureDialogBody({
  culture,
  isReassignDisabled,
  otherCultures,
  reassignToId,
  setReassignToId,
  usageQuery,
}: DeleteCultureDialogBodyProps): JSX.Element {
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
        Delete "{culture.name}"? Nothing references it.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground">
        {usage.citizenCount} citizen{usage.citizenCount === 1 ? "" : "s"} and{" "}
        {usage.nationCount} nation{usage.nationCount === 1 ? "" : "s"} currently
        reference "{culture.name}".
      </p>
      {otherCultures.length > 0 ? (
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
            {otherCultures.map((option) => (
              <option key={option.id} value={option.id}>
                Reassign to {option.name}
              </option>
            ))}
          </NativeSelect>
        </Label>
      ) : (
        <p className="text-xs text-muted-foreground">
          References will be cleared — no other cultures exist in this world to
          reassign to.
        </p>
      )}
    </>
  );
}

export function DeleteCultureDialog({
  culture,
  onClose,
  queryClient,
  worldId,
}: DeleteCultureDialogProps): JSX.Element {
  const [reassignToId, setReassignToId] = useState<string | null>(null);

  const culturesQuery = useQuery(culturesByWorldQueryOptions(worldId));
  const usageQuery = useQuery(cultureUsageQueryOptions(culture.id));
  const deleteMutation = useMutation(
    deleteCultureMutationOptions({ queryClient }),
  );

  const otherCultures = (culturesQuery.data ?? []).filter(
    (option) => option.id !== culture.id,
  );

  async function handleConfirm(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({
        cultureId: culture.id,
        reassignToId,
        worldId,
      });
      notifyMutationSuccess("Culture deleted.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to delete culture.");
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
          <DialogTitle>Delete culture</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <DeleteCultureDialogBody
            culture={culture}
            isReassignDisabled={deleteMutation.isPending}
            otherCultures={otherCultures}
            reassignToId={reassignToId}
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
