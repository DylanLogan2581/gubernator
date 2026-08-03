import { useQuery } from "@tanstack/react-query";
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
import {
  blueprintsByWorldQueryOptions,
  buildCostInputs,
  tiersByBlueprintQueryOptions,
  type CostRowState,
} from "@/features/buildings";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createUnitTypeInputSchema,
  type CreateUnitTypeInput,
} from "../../schemas/unitTypeSchemas";

import {
  UnitTypeFormFields,
  type UnitTypeFieldErrors,
} from "./UnitTypeFormFields";

export function CreateUnitTypeForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateUnitTypeInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [soldiersPerUnit, setSoldiersPerUnit] = useState("1");
  const [desertionRate, setDesertionRate] = useState("0");
  const [requiredEducationLevelId, setRequiredEducationLevelId] = useState("");
  const [requiredBuildingBlueprintId, setRequiredBuildingBlueprintId] =
    useState("");
  const [requiredBuildingTierNumber, setRequiredBuildingTierNumber] =
    useState("");
  const [recruitmentRows, setRecruitmentRows] = useState<CostRowState[]>([]);
  const [upkeepRows, setUpkeepRows] = useState<CostRowState[]>([]);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateUnitTypeInput = {
      description: description.length > 0 ? description : undefined,
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
      upkeepCostsJson: buildCostInputs(upkeepRows),
      worldId,
    };

    const result = createUnitTypeInputSchema.safeParse(input);
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
            <DialogTitle>Create unit type</DialogTitle>
            <DialogDescription>
              Define a recruitable unit type — its costs, upkeep, desertion
              rate, and recruitment requirements.
            </DialogDescription>
          </DialogHeader>
          <UnitTypeFormFields
            activeBlueprints={activeBlueprints}
            activeResources={resourcesQuery.data ?? []}
            description={description}
            desertionRate={desertionRate}
            desertionRatePlaceholder="0"
            disabled={isPending}
            educationLevels={educationLevelsQuery.data ?? []}
            fieldErrors={fieldErrors}
            idPrefix="unit-type"
            name={name}
            recruitmentRows={recruitmentRows}
            requiredBuildingBlueprintId={requiredBuildingBlueprintId}
            requiredBuildingTierNumber={requiredBuildingTierNumber}
            requiredEducationLevelId={requiredEducationLevelId}
            soldiersPerUnit={soldiersPerUnit}
            soldiersPerUnitPlaceholder="1"
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
