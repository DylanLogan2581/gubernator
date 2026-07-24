import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { notifyMutationSuccess } from "@/lib/notify";
import { roundDecimal } from "@/lib/roundDecimal";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  deleteEducationLevelMutationOptions,
  updateEducationLevelMutationOptions,
} from "../../mutations/educationLevelsMutations";
import {
  updateEducationLevelInputSchema,
  type UpdateEducationLevelInput,
} from "../../schemas/educationLevelSchemas";

import {
  EducationLevelFormFields,
  type EducationLevelFieldErrors,
} from "./EducationLevelFormFields";

import type { EducationLevel } from "../../types/educationLevelTypes";

type EditEducationLevelFormProps = {
  readonly educationLevel: EducationLevel;
  readonly onClose: () => void;
  readonly otherLevelsNaturalBornPercentTotal: number;
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

export function EditEducationLevelForm({
  educationLevel,
  onClose,
  otherLevelsNaturalBornPercentTotal,
  queryClient,
  worldId,
}: EditEducationLevelFormProps): JSX.Element {
  const updateMutation = useMutation(
    updateEducationLevelMutationOptions({ queryClient }),
  );
  const deleteMutation = useMutation(
    deleteEducationLevelMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(educationLevel.name);
  const [description, setDescription] = useState(
    educationLevel.description ?? "",
  );
  const [naturalBornPercent, setNaturalBornPercent] = useState(
    String(educationLevel.naturalBornPercent),
  );
  const [icon, setIcon] = useState<string | null>(educationLevel.icon);
  const [iconColor, setIconColor] = useState<CategoricalSlot | null>(
    educationLevel.iconColor as CategoricalSlot | null,
  );
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof EducationLevelFieldErrors>();

  const isPending = updateMutation.isPending || deleteMutation.isPending;
  const parsedNaturalBornPercent = Number(naturalBornPercent);
  const naturalBornPercentValue = Number.isNaN(parsedNaturalBornPercent)
    ? 0
    : parsedNaturalBornPercent;
  const projectedTotal = roundDecimal(
    otherLevelsNaturalBornPercentTotal + naturalBornPercentValue,
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input: UpdateEducationLevelInput = {
      description,
      educationLevelId: educationLevel.id,
      icon,
      iconColor,
      name,
      naturalBornPercent: naturalBornPercentValue,
      worldId,
    };

    const result = updateEducationLevelInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Education level saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save education level.");
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({
        educationLevelId: educationLevel.id,
        worldId,
      });
      notifyMutationSuccess("Education level deleted.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to delete education level.");
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
        <form
          aria-label="Edit education level"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit education level</DialogTitle>
          </DialogHeader>
          <EducationLevelFormFields
            description={description}
            disabled={isPending}
            fieldErrors={fieldErrors}
            icon={icon}
            iconColor={iconColor}
            idPrefix="edit-education-level"
            name={name}
            naturalBornPercent={naturalBornPercent}
            onDescriptionChange={setDescription}
            onIconChange={setIcon}
            onIconColorChange={setIconColor}
            onNameChange={setName}
            onNaturalBornPercentChange={setNaturalBornPercent}
            projectedTotal={projectedTotal}
          />
          <p className="text-xs text-muted-foreground">
            Deleting a level that is still assigned to citizens, jobs, or
            building tiers will fail until nothing references it.
          </p>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                void handleDelete();
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
    </Dialog>
  );
}
