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

import { updateCultureMutationOptions } from "../../mutations/culturesMutations";
import {
  updateCultureInputSchema,
  type UpdateCultureInput,
} from "../../schemas/cultureSchemas";

import { DeleteCultureDialog } from "./DeleteCultureDialog";

import type { Culture } from "../../types/cultureTypes";

type CultureFieldErrors = {
  readonly color?: string;
  readonly description?: string;
  readonly name?: string;
};

type EditCultureFormProps = {
  readonly culture: Culture;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

export function EditCultureForm({
  culture,
  onClose,
  queryClient,
  worldId,
}: EditCultureFormProps): JSX.Element {
  const updateMutation = useMutation(
    updateCultureMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(culture.name);
  const [description, setDescription] = useState(culture.description ?? "");
  const [color, setColor] = useState(culture.color);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof CultureFieldErrors>();

  const isPending = updateMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input: UpdateCultureInput = {
      color,
      cultureId: culture.id,
      description,
      name,
      worldId,
    };

    const result = updateCultureInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Culture saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save culture.");
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
          aria-label="Edit culture"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit culture</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor="edit-culture-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="edit-culture-name"
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
              htmlFor="edit-culture-description"
            >
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id="edit-culture-description"
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
        <DeleteCultureDialog
          culture={culture}
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
