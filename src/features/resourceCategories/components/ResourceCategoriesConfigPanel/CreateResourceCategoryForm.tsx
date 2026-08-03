import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createResourceCategoryInputSchema,
  type CreateResourceCategoryInput,
} from "../../schemas/resourceCategorySchemas";

import {
  ResourceCategoryFormFields,
  type ResourceCategoryFieldErrors,
} from "./ResourceCategoryFormFields";

const DEFAULT_COLOR = "#6b7280";

type CreateResourceCategoryFormProps = {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateResourceCategoryInput) => void;
  readonly worldId: string;
};

export function CreateResourceCategoryForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: CreateResourceCategoryFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof ResourceCategoryFieldErrors>();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateResourceCategoryInput = {
      color,
      name,
      worldId,
    };

    const result = createResourceCategoryInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    onSubmit(input);
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create resource category</DialogTitle>
            <DialogDescription>
              Group resources in this world under a shared category.
            </DialogDescription>
          </DialogHeader>
          <ResourceCategoryFormFields
            color={color}
            disabled={isPending}
            fieldErrors={fieldErrors}
            idPrefix="create-resource-category"
            name={name}
            onColorChange={setColor}
            onNameChange={(value) => {
              setName(value);
              if (fieldErrors.name !== undefined) {
                clear();
              }
            }}
          />
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
