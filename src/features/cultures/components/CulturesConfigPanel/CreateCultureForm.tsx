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
import { Textarea } from "@/components/ui/textarea";
import { cultureReligionInputLimits } from "@/lib/inputLimits";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createCultureInputSchema,
  type CreateCultureInput,
} from "../../schemas/cultureSchemas";

const DEFAULT_COLOR = "#6b7280";

type CreateCultureFieldErrors = {
  readonly color?: string;
  readonly description?: string;
  readonly name?: string;
};

type CreateCultureFormProps = {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateCultureInput) => void;
  readonly worldId: string;
};

export function CreateCultureForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: CreateCultureFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof CreateCultureFieldErrors>();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateCultureInput = {
      color,
      description,
      name,
      worldId,
    };

    const result = createCultureInputSchema.safeParse(input);
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
            <DialogTitle>Create culture</DialogTitle>
            <DialogDescription>
              Define a culture that nations in this world can adopt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor="create-culture-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="create-culture-name"
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
              htmlFor="create-culture-description"
            >
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id="create-culture-description"
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
