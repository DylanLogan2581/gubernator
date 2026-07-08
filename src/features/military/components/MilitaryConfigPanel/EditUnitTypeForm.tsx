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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  blueprintsByWorldQueryOptions,
  buildCostInputs,
  CostEditor,
  tierCostsToState,
  tiersByBlueprintQueryOptions,
  type CostRowState,
} from "@/features/buildings";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { unitTypeInputLimits } from "@/lib/inputLimits";
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

import type { UnitType } from "../../types/unitTypeTypes";

type UnitTypeFieldErrors = {
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
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor="edit-unit-type-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                disabled={isPending}
                id="edit-unit-type-name"
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
              htmlFor="edit-unit-type-description"
            >
              <span className="text-muted-foreground">Description</span>
              <Textarea
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isPending}
                id="edit-unit-type-description"
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
              htmlFor="edit-unit-type-soldiers-per-unit"
            >
              <span className="text-muted-foreground">Soldiers per unit</span>
              <Input
                aria-invalid={fieldErrors.soldiersPerUnit !== undefined}
                disabled={isPending}
                id="edit-unit-type-soldiers-per-unit"
                inputMode="numeric"
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
              htmlFor="edit-unit-type-desertion-rate"
            >
              <span className="text-muted-foreground">
                Desertion rate (0–1 per unpaid turn)
              </span>
              <Input
                aria-invalid={fieldErrors.desertionRate !== undefined}
                disabled={isPending}
                id="edit-unit-type-desertion-rate"
                inputMode="decimal"
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
              htmlFor="edit-unit-type-required-education-level"
            >
              <span className="text-muted-foreground">
                Required education level
              </span>
              <NativeSelect
                aria-invalid={
                  fieldErrors.requiredEducationLevelId !== undefined
                }
                disabled={isPending}
                id="edit-unit-type-required-education-level"
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
              htmlFor="edit-unit-type-required-blueprint"
            >
              <span className="text-muted-foreground">Required building</span>
              <NativeSelect
                aria-invalid={
                  fieldErrors.requiredBuildingBlueprintId !== undefined
                }
                disabled={isPending}
                id="edit-unit-type-required-blueprint"
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
                htmlFor="edit-unit-type-required-tier"
              >
                <span className="text-muted-foreground">
                  Minimum building tier
                </span>
                <NativeSelect
                  aria-invalid={
                    fieldErrors.requiredBuildingTierNumber !== undefined
                  }
                  disabled={isPending || tiersQuery.isPending}
                  id="edit-unit-type-required-tier"
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
