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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  blueprintsByWorldQueryOptions,
  buildCostInputs,
  CostEditor,
  tiersByBlueprintQueryOptions,
  type CostRowState,
} from "@/features/buildings";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { unitTypeInputLimits } from "@/lib/inputLimits";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createUnitTypeInputSchema,
  type CreateUnitTypeInput,
} from "../../schemas/unitTypeSchemas";

type CreateUnitTypeFieldErrors = {
  readonly description?: string;
  readonly desertionRate?: string;
  readonly name?: string;
  readonly recruitmentCostsJson?: string;
  readonly requiredBuildingBlueprintId?: string;
  readonly requiredBuildingTierNumber?: string;
  readonly requiredEducationLevelId?: string;
  readonly soldiersPerUnit?: string;
  readonly upkeepCostsJson?: string;
};

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
    useFieldErrors<keyof CreateUnitTypeFieldErrors>();

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
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor="unit-type-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                disabled={isPending}
                id="unit-type-name"
                maxLength={unitTypeInputLimits.nameMax}
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
              htmlFor="unit-type-description"
            >
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id="unit-type-description"
                maxLength={unitTypeInputLimits.descriptionMax}
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
              htmlFor="unit-type-soldiers-per-unit"
            >
              <span className="text-muted-foreground">Soldiers per unit</span>
              <Input
                aria-invalid={fieldErrors.soldiersPerUnit !== undefined}
                disabled={isPending}
                id="unit-type-soldiers-per-unit"
                inputMode="numeric"
                placeholder="1"
                value={soldiersPerUnit}
                onChange={(e) => {
                  setSoldiersPerUnit(e.currentTarget.value);
                }}
              />
              {fieldErrors.soldiersPerUnit !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.soldiersPerUnit}
                </p>
              ) : null}
            </Label>
            <Label
              className="grid gap-1 text-sm"
              htmlFor="unit-type-desertion-rate"
            >
              <span className="text-muted-foreground">
                Desertion rate (0–1 per unpaid turn)
              </span>
              <Input
                aria-invalid={fieldErrors.desertionRate !== undefined}
                disabled={isPending}
                id="unit-type-desertion-rate"
                inputMode="decimal"
                placeholder="0"
                value={desertionRate}
                onChange={(e) => {
                  setDesertionRate(e.currentTarget.value);
                }}
              />
              {fieldErrors.desertionRate !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.desertionRate}
                </p>
              ) : null}
            </Label>
            <Label
              className="grid gap-1 text-sm"
              htmlFor="unit-type-required-education-level"
            >
              <span className="text-muted-foreground">
                Required education level
              </span>
              <NativeSelect
                aria-invalid={
                  fieldErrors.requiredEducationLevelId !== undefined
                }
                disabled={isPending}
                id="unit-type-required-education-level"
                value={requiredEducationLevelId}
                onChange={(e) => {
                  setRequiredEducationLevelId(e.currentTarget.value);
                }}
              >
                <option value="">None</option>
                {(educationLevelsQuery.data ?? []).map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </NativeSelect>
              {fieldErrors.requiredEducationLevelId !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.requiredEducationLevelId}
                </p>
              ) : null}
            </Label>
            <Label
              className="grid gap-1 text-sm"
              htmlFor="unit-type-required-blueprint"
            >
              <span className="text-muted-foreground">Required building</span>
              <NativeSelect
                aria-invalid={
                  fieldErrors.requiredBuildingBlueprintId !== undefined
                }
                disabled={isPending}
                id="unit-type-required-blueprint"
                value={requiredBuildingBlueprintId}
                onChange={(e) => {
                  setRequiredBuildingBlueprintId(e.currentTarget.value);
                  setRequiredBuildingTierNumber("");
                }}
              >
                <option value="">None — recruit anywhere</option>
                {activeBlueprints.map((blueprint) => (
                  <option key={blueprint.id} value={blueprint.id}>
                    {blueprint.name}
                  </option>
                ))}
              </NativeSelect>
              {fieldErrors.requiredBuildingBlueprintId !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.requiredBuildingBlueprintId}
                </p>
              ) : null}
            </Label>
            {requiredBuildingBlueprintId !== "" ? (
              <Label
                className="grid gap-1 text-sm"
                htmlFor="unit-type-required-tier"
              >
                <span className="text-muted-foreground">
                  Minimum building tier
                </span>
                <NativeSelect
                  aria-invalid={
                    fieldErrors.requiredBuildingTierNumber !== undefined
                  }
                  disabled={isPending || tiersQuery.isPending}
                  id="unit-type-required-tier"
                  value={requiredBuildingTierNumber}
                  onChange={(e) => {
                    setRequiredBuildingTierNumber(e.currentTarget.value);
                  }}
                >
                  <option value="">Select tier</option>
                  {(tiersQuery.data ?? []).map((tier) => (
                    <option key={tier.id} value={tier.tierNumber}>
                      Tier {tier.tierNumber}
                    </option>
                  ))}
                </NativeSelect>
                {fieldErrors.requiredBuildingTierNumber !== undefined ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.requiredBuildingTierNumber}
                  </p>
                ) : null}
              </Label>
            ) : null}
            <CostEditor
              activeResources={resourcesQuery.data ?? []}
              disabled={isPending}
              error={fieldErrors.recruitmentCostsJson}
              label="Recruitment cost (per soldier)"
              rows={recruitmentRows}
              onChange={setRecruitmentRows}
            />
            <CostEditor
              activeResources={resourcesQuery.data ?? []}
              disabled={isPending}
              error={fieldErrors.upkeepCostsJson}
              label="Upkeep cost (per soldier, per turn)"
              rows={upkeepRows}
              onChange={setUpkeepRows}
            />
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
