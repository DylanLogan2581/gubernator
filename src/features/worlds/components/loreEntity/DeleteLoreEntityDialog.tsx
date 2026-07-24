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

import type {
  LoreEntityBase,
  LoreEntityDescriptor,
  LoreEntityLabels,
  LoreEntityUsage,
} from "./LoreEntityTypes";

type DeleteLoreEntityDialogBodyProps<TEntity extends LoreEntityBase> = {
  readonly entity: TEntity;
  readonly isReassignDisabled: boolean;
  readonly labels: LoreEntityLabels;
  readonly otherEntities: readonly TEntity[];
  readonly reassignToId: string | null;
  readonly setReassignToId: (id: string | null) => void;
  readonly usageQuery: {
    readonly data: LoreEntityUsage | undefined;
    readonly isError: boolean;
    readonly isPending: boolean;
  };
};

function DeleteLoreEntityDialogBody<TEntity extends LoreEntityBase>({
  entity,
  isReassignDisabled,
  labels,
  otherEntities,
  reassignToId,
  setReassignToId,
  usageQuery,
}: DeleteLoreEntityDialogBodyProps<TEntity>): JSX.Element {
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
        Delete "{entity.name}"? Nothing references it.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted-foreground">
        {usage.citizenCount} citizen{usage.citizenCount === 1 ? "" : "s"} and{" "}
        {usage.nationCount} nation{usage.nationCount === 1 ? "" : "s"} currently
        reference "{entity.name}".
      </p>
      {otherEntities.length > 0 ? (
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
            {otherEntities.map((option) => (
              <option key={option.id} value={option.id}>
                Reassign to {option.name}
              </option>
            ))}
          </NativeSelect>
        </Label>
      ) : (
        <p className="text-xs text-muted-foreground">
          References will be cleared — no other {labels.plural} exist in this
          world to reassign to.
        </p>
      )}
    </>
  );
}

type DeleteLoreEntityDialogProps<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
> = {
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly entity: TEntity;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

export function DeleteLoreEntityDialog<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  descriptor,
  entity,
  onClose,
  queryClient,
  worldId,
}: DeleteLoreEntityDialogProps<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError
>): JSX.Element {
  const { labels } = descriptor;
  const [reassignToId, setReassignToId] = useState<string | null>(null);

  const entitiesQuery = useQuery(descriptor.queries.byWorld(worldId));
  const usageQuery = useQuery(descriptor.queries.usage(entity.id));
  const deleteMutation = useMutation(
    descriptor.mutations.delete({ queryClient }),
  );

  const otherEntities = (entitiesQuery.data ?? []).filter(
    (option) => option.id !== entity.id,
  );

  async function handleConfirm(): Promise<void> {
    try {
      await deleteMutation.mutateAsync(
        descriptor.buildDeleteInput({ id: entity.id, reassignToId, worldId }),
      );
      notifyMutationSuccess(`${labels.singularCapital} deleted.`);
      onClose();
    } catch (error) {
      handleCrudError(error, `Failed to delete ${labels.singular}.`);
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
          <DialogTitle>Delete {labels.singular}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <DeleteLoreEntityDialogBody
            entity={entity}
            isReassignDisabled={deleteMutation.isPending}
            labels={labels}
            otherEntities={otherEntities}
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
