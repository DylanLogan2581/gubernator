import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
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
import {
  blueprintsByWorldQueryOptions,
  buildCostInputs,
  tierCostsToState,
  tiersByBlueprintQueryOptions,
  type CostRowState,
} from "@/features/buildings";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { notifyMutationSuccess } from "@/lib/notify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  deleteUnitTypeMutationOptions,
  updateUnitTypeMutationOptions,
} from "../../mutations/unitTypesMutations";
import {
  updateUnitTypeInputSchema,
  type UpdateUnitTypeInput,
} from "../../schemas/unitTypeSchemas";

import {
  UnitTypeFormFields,
  type UnitTypeFieldErrors,
} from "./UnitTypeFormFields";

import type { UnitType } from "../../types/unitTypeTypes";

export function EditUnitTypeForm({
  onClose,
  queryClient,
  unitType,
  worldId,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly unitType: UnitType;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(
    updateUnitTypeMutationOptions({ queryClient }),
  );
  const deleteMutation = useMutation(
    deleteUnitTypeMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(unitType.name);
  const [description, setDescription] = useState(unitType.description ?? "");
  const [soldiersPerUnit, setSoldiersPerUnit] = useState(
    String(unitType.soldiersPerUnit),
  );
  const [desertionRate, setDesertionRate] = useState(
    String(unitType.desertionRate),
  );
  const [requiredEducationLevelId, setRequiredEducationLevelId] = useState(
    unitType.requiredEducationLevelId ?? "",
  );
  const [requiredBuildingBlueprintId, setRequiredBuildingBlueprintId] =
    useState(unitType.requiredBuildingBlueprintId ?? "");
  const [requiredBuildingTierNumber, setRequiredBuildingTierNumber] = useState(
    unitType.requiredBuildingTierNumber !== null
      ? String(unitType.requiredBuildingTierNumber)
      : "",
  );
  const [recruitmentRows, setRecruitmentRows] = useState<CostRowState[]>(() =>
    tierCostsToState(unitType.recruitmentCostsJson),
  );
  const [upkeepRows, setUpkeepRows] = useState<CostRowState[]>(() =>
    tierCostsToState(unitType.upkeepCostsJson),
  );
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof UnitTypeFieldErrors>();

  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(worldId),
  );
  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));
  const tiersQuery = useQuery({
    ...tiersByBlueprintQueryOptions(requiredBuildingBlueprintId),
    enabled: requiredBuildingBlueprintId !== "",
  });

  const activeBlueprints = (blueprintsQuery.data ?? []).filter(
    (b) => !b.isTrashed,
  );

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const input: UpdateUnitTypeInput = {
      description,
      desertionRate: desertionRate !== "" ? parseFloat(desertionRate) : 0,
      name,
      recruitmentCostsJson: buildCostInputs(recruitmentRows),
      requiredBuildingBlueprintId:
        requiredBuildingBlueprintId !== "" ? requiredBuildingBlueprintId : null,
      requiredBuildingTierNumber:
        requiredBuildingTierNumber !== ""
          ? parseInt(requiredBuildingTierNumber, 10)
          : null,
      requiredEducationLevelId:
        requiredEducationLevelId !== "" ? requiredEducationLevelId : null,
      soldiersPerUnit:
        soldiersPerUnit !== "" ? parseInt(soldiersPerUnit, 10) : 0,
      unitTypeId: unitType.id,
      upkeepCostsJson: buildCostInputs(upkeepRows),
      worldId,
    };

    const result = updateUnitTypeInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Unit type saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save unit type.");
    }
  }

  async function handleDelete(): Promise<void> {
    try {
      await deleteMutation.mutateAsync({ unitTypeId: unitType.id, worldId });
      notifyMutationSuccess("Unit type deleted.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to delete unit type.");
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
          aria-label="Edit unit type"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit unit type</DialogTitle>
          </DialogHeader>
          <UnitTypeFormFields
            activeBlueprints={activeBlueprints}
            activeResources={resourcesQuery.data ?? []}
            description={description}
            desertionRate={desertionRate}
            disabled={isPending}
            educationLevels={educationLevelsQuery.data ?? []}
            fieldErrors={fieldErrors}
            idPrefix="edit-unit-type"
            name={name}
            recruitmentRows={recruitmentRows}
            requiredBuildingBlueprintId={requiredBuildingBlueprintId}
            requiredBuildingTierNumber={requiredBuildingTierNumber}
            requiredEducationLevelId={requiredEducationLevelId}
            soldiersPerUnit={soldiersPerUnit}
            tiers={tiersQuery.data ?? []}
            tiersPending={tiersQuery.isPending}
            upkeepRows={upkeepRows}
            onBlueprintChange={(value) => {
              setRequiredBuildingBlueprintId(value);
              setRequiredBuildingTierNumber("");
            }}
            onDescriptionChange={setDescription}
            onDesertionRateChange={setDesertionRate}
            onEducationLevelChange={setRequiredEducationLevelId}
            onNameChange={setName}
            onRecruitmentRowsChange={setRecruitmentRows}
            onSoldiersPerUnitChange={setSoldiersPerUnit}
            onTierChange={setRequiredBuildingTierNumber}
            onUpkeepRowsChange={setUpkeepRows}
          />
          <p className="text-xs text-muted-foreground">
            Deleting a unit type that is still in use will fail until nothing
            references it.
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
