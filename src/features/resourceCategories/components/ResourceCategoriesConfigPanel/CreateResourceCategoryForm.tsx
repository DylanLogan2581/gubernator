import { useState, type FormEvent, type JSX } from "react";

import { ColorPicker } from "@/components/shared/ColorPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resourceCategoryInputLimits } from "@/lib/inputLimits";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createResourceCategoryInputSchema,
  type CreateResourceCategoryInput,
} from "../../schemas/resourceCategorySchemas";

const DEFAULT_COLOR = "#6b7280";

type CreateResourceCategoryFieldErrors = {
  readonly color?: string;
  readonly name?: string;
};

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
    useFieldErrors<keyof CreateResourceCategoryFieldErrors>();

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
          <div className="grid gap-3">
            <Label
              className="grid gap-1 text-sm"
              htmlFor="create-resource-category-name"
            >
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="create-resource-category-name"
                maxLength={resourceCategoryInputLimits.nameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                  if (fieldErrors.name !== undefined) {
                    clear();
                  }
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
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
