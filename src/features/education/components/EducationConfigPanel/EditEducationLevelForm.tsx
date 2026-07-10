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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { educationLevelInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  deleteEducationLevelMutationOptions,
  updateEducationLevelMutationOptions,
} from "../../mutations/educationLevelsMutations";
import {
  updateEducationLevelInputSchema,
  type UpdateEducationLevelInput,
} from "../../schemas/educationLevelSchemas";

import type { EducationLevel } from "../../types/educationLevelTypes";

type EducationLevelFieldErrors = {
  readonly description?: string;
  readonly name?: string;
  readonly naturalBornPercent?: string;
};

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
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof EducationLevelFieldErrors>();

  const isPending = updateMutation.isPending || deleteMutation.isPending;
  const parsedNaturalBornPercent = Number(naturalBornPercent);
  const naturalBornPercentValue = Number.isNaN(parsedNaturalBornPercent)
    ? 0
    : parsedNaturalBornPercent;
  const projectedTotal =
    otherLevelsNaturalBornPercentTotal + naturalBornPercentValue;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input: UpdateEducationLevelInput = {
      description,
      educationLevelId: educationLevel.id,
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
          <div className="grid gap-3">
            <Label
              className="grid gap-1 text-sm"
              htmlFor="edit-education-level-name"
            >
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="edit-education-level-name"
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
              htmlFor="edit-education-level-description"
            >
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id="edit-education-level-description"
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
            <Label
              className="grid gap-1 text-sm"
              htmlFor="edit-education-level-natural-born-percent"
            >
              <span className="text-muted-foreground">Natural born %</span>
              <Input
                aria-invalid={fieldErrors.naturalBornPercent !== undefined}
                aria-label="Natural born %"
                disabled={isPending}
                id="edit-education-level-natural-born-percent"
                max={100}
                min={0}
                type="number"
                value={naturalBornPercent}
                onChange={(e) => {
                  setNaturalBornPercent(e.currentTarget.value);
                }}
              />
              {fieldErrors.naturalBornPercent !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.naturalBornPercent}
                </p>
              ) : (
                <p
                  className={
                    projectedTotal > 100
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  World total would be {projectedTotal} / 100
                  {projectedTotal > 100 ? " — over the limit" : ""}
                </p>
              )}
            </Label>
          </div>
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
