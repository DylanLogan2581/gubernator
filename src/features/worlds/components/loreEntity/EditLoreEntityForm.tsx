import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { ColorPicker } from "@/components/shared/ColorPicker";
import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cultureReligionInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import { DeleteLoreEntityDialog } from "./DeleteLoreEntityDialog";

import type { LoreEntityBase, LoreEntityDescriptor } from "./LoreEntityTypes";

type EditLoreEntityFieldErrors = {
  readonly color?: string;
  readonly description?: string;
  readonly name?: string;
};

type EditLoreEntityFormProps<
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

export function EditLoreEntityForm<
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
}: EditLoreEntityFormProps<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError
>): JSX.Element {
  const { labels } = descriptor;
  const updateMutation = useMutation(
    descriptor.mutations.update({ queryClient }),
  );

  const [name, setName] = useState(entity.name);
  const [description, setDescription] = useState(entity.description ?? "");
  const [color, setColor] = useState(entity.color);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof EditLoreEntityFieldErrors>();

  const isPending = updateMutation.isPending;
  const nameId = `edit-${labels.singular}-name`;
  const descriptionId = `edit-${labels.singular}-description`;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input = descriptor.buildUpdateInput({
      id: entity.id,
      patch: { color, description, name },
      worldId,
    });

    const result = descriptor.updateInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess(`${labels.singularCapital} saved.`);
      onClose();
    } catch (error) {
      handleCrudError(error, `Failed to save ${labels.singular}.`);
    }
  }

  return (
    <Dialog
      open={!showDeleteDialog}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          aria-label={`Edit ${labels.singular}`}
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {labels.singular}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor={nameId}>
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id={nameId}
                maxLength={cultureReligionInputLimits.nameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor={descriptionId}>
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id={descriptionId}
                maxLength={cultureReligionInputLimits.descriptionMax}
                value={description}
                onChange={(e) => {
                  setDescription(e.currentTarget.value);
                }}
              />
              {fieldErrors.description !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.description}
                </p>
              ) : null}
            </Label>
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Color</span>
              <ColorPicker
                disabled={isPending}
                value={color}
                onChange={setColor}
              />
              {fieldErrors.color !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.color}</p>
              ) : null}
            </Label>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
      {showDeleteDialog ? (
        <DeleteLoreEntityDialog
          descriptor={descriptor}
          entity={entity}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setShowDeleteDialog(false);
            onClose();
          }}
        />
      ) : null}
    </Dialog>
  );
}
