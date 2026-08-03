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
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { roundDecimal } from "@/lib/roundDecimal";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createEducationLevelInputSchema,
  type CreateEducationLevelInput,
} from "../../schemas/educationLevelSchemas";

import {
  EducationLevelFormFields,
  type EducationLevelFieldErrors,
} from "./EducationLevelFormFields";

type CreateEducationLevelFormProps = {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateEducationLevelInput) => void;
  readonly otherLevelsNaturalBornPercentTotal: number;
  readonly worldId: string;
};

export function CreateEducationLevelForm({
  isPending,
  onCancel,
  onSubmit,
  otherLevelsNaturalBornPercentTotal,
  worldId,
}: CreateEducationLevelFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [naturalBornPercent, setNaturalBornPercent] = useState("0");
  const [icon, setIcon] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState<CategoricalSlot | null>(null);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof EducationLevelFieldErrors>();

  const parsedNaturalBornPercent = Number(naturalBornPercent);
  const naturalBornPercentValue = Number.isNaN(parsedNaturalBornPercent)
    ? 0
    : parsedNaturalBornPercent;
  const projectedTotal = roundDecimal(
    otherLevelsNaturalBornPercentTotal + naturalBornPercentValue,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateEducationLevelInput = {
      description,
      icon,
      iconColor,
      name,
      naturalBornPercent: naturalBornPercentValue,
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
          <EducationLevelFormFields
            description={description}
            disabled={isPending}
            fieldErrors={fieldErrors}
            icon={icon}
            iconColor={iconColor}
            idPrefix="create-education-level"
            name={name}
            naturalBornPercent={naturalBornPercent}
            onDescriptionChange={setDescription}
            onIconChange={setIcon}
            onIconColorChange={setIconColor}
            onNameChange={setName}
            onNaturalBornPercentChange={setNaturalBornPercent}
            projectedTotal={projectedTotal}
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
