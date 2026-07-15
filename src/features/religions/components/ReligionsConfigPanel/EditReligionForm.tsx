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

import { updateReligionMutationOptions } from "../../mutations/religionsMutations";
import {
  updateReligionInputSchema,
  type UpdateReligionInput,
} from "../../schemas/religionSchemas";

import { DeleteReligionDialog } from "./DeleteReligionDialog";

import type { Religion } from "../../types/religionTypes";

type ReligionFieldErrors = {
  readonly color?: string;
  readonly description?: string;
  readonly name?: string;
};

type EditReligionFormProps = {
  readonly religion: Religion;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

export function EditReligionForm({
  religion,
  onClose,
  queryClient,
  worldId,
}: EditReligionFormProps): JSX.Element {
  const updateMutation = useMutation(
    updateReligionMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(religion.name);
  const [description, setDescription] = useState(religion.description ?? "");
  const [color, setColor] = useState(religion.color);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof ReligionFieldErrors>();

  const isPending = updateMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input: UpdateReligionInput = {
      color,
      religionId: religion.id,
      description,
      name,
      worldId,
    };

    const result = updateReligionInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Religion saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save religion.");
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
          aria-label="Edit religion"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit religion</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor="edit-religion-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="edit-religion-name"
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
            <Label
              className="grid gap-1 text-sm"
              htmlFor="edit-religion-description"
            >
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id="edit-religion-description"
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
        <DeleteReligionDialog
          queryClient={queryClient}
          religion={religion}
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
