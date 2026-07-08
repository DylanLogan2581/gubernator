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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { educationLevelInputLimits } from "@/lib/inputLimits";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createEducationLevelInputSchema,
  type CreateEducationLevelInput,
} from "../../schemas/educationLevelSchemas";

type CreateEducationLevelFieldErrors = {
  readonly description?: string;
  readonly name?: string;
};

type CreateEducationLevelFormProps = {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateEducationLevelInput) => void;
  readonly worldId: string;
};

export function CreateEducationLevelForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: CreateEducationLevelFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof CreateEducationLevelFieldErrors>();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateEducationLevelInput = {
      description,
      name,
      worldId,
    };

    const result = createEducationLevelInputSchema.safeParse(input);
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
            <DialogTitle>Create education level</DialogTitle>
            <DialogDescription>
              Add a rung to this world&apos;s education ladder. New levels are
              appended to the end; use the up/down buttons to reorder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label
              className="grid gap-1 text-sm"
              htmlFor="create-education-level-name"
            >
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="create-education-level-name"
                maxLength={educationLevelInputLimits.nameMax}
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
              htmlFor="create-education-level-description"
            >
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id="create-education-level-description"
                maxLength={educationLevelInputLimits.descriptionMax}
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
