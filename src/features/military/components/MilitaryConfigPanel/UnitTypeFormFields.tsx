import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  CostEditor,
  type BuildingBlueprint,
  type BuildingBlueprintTier,
  type CostRowState,
} from "@/features/buildings";
import type { EducationLevel } from "@/features/education";
import type { Resource } from "@/features/resources";
import { unitTypeInputLimits } from "@/lib/inputLimits";

import type { JSX } from "react";

export type UnitTypeFieldErrors = {
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

export function UnitTypeFormFields({
  activeBlueprints,
  activeResources,
  description,
  desertionRate,
  desertionRatePlaceholder,
  disabled,
  educationLevels,
  fieldErrors,
  idPrefix,
  name,
  onBlueprintChange,
  onDescriptionChange,
  onDesertionRateChange,
  onEducationLevelChange,
  onNameChange,
  onRecruitmentRowsChange,
  onSoldiersPerUnitChange,
  onTierChange,
  onUpkeepRowsChange,
  recruitmentRows,
  requiredBuildingBlueprintId,
  requiredBuildingTierNumber,
  requiredEducationLevelId,
  soldiersPerUnit,
  soldiersPerUnitPlaceholder,
  tiers,
  tiersPending,
  upkeepRows,
}: {
  readonly activeBlueprints: readonly BuildingBlueprint[];
  readonly activeResources: readonly Resource[];
  readonly description: string;
  readonly desertionRate: string;
  readonly desertionRatePlaceholder?: string;
  readonly disabled: boolean;
  readonly educationLevels: readonly EducationLevel[];
  readonly fieldErrors: UnitTypeFieldErrors;
  readonly idPrefix: string;
  readonly name: string;
  readonly onBlueprintChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onDesertionRateChange: (value: string) => void;
  readonly onEducationLevelChange: (value: string) => void;
  readonly onNameChange: (value: string) => void;
  readonly onRecruitmentRowsChange: (rows: CostRowState[]) => void;
  readonly onSoldiersPerUnitChange: (value: string) => void;
  readonly onTierChange: (value: string) => void;
  readonly onUpkeepRowsChange: (rows: CostRowState[]) => void;
  readonly recruitmentRows: CostRowState[];
  readonly requiredBuildingBlueprintId: string;
  readonly requiredBuildingTierNumber: string;
  readonly requiredEducationLevelId: string;
  readonly soldiersPerUnit: string;
  readonly soldiersPerUnitPlaceholder?: string;
  readonly tiers: readonly BuildingBlueprintTier[];
  readonly tiersPending: boolean;
  readonly upkeepRows: CostRowState[];
}): JSX.Element {
  return (
    <div className="grid gap-3">
      <Label className="grid gap-1 text-sm" htmlFor={`${idPrefix}-name`}>
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={fieldErrors.name !== undefined}
          disabled={disabled}
          id={`${idPrefix}-name`}
          maxLength={unitTypeInputLimits.nameMax}
          value={name}
          onChange={(e) => {
            onNameChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.name !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        ) : null}
      </Label>
      <Label className="grid gap-1 text-sm" htmlFor={`${idPrefix}-description`}>
        <span className="text-muted-foreground">Description</span>
        <Textarea
          aria-invalid={fieldErrors.description !== undefined}
          disabled={disabled}
          id={`${idPrefix}-description`}
          maxLength={unitTypeInputLimits.descriptionMax}
          value={description}
          onChange={(e) => {
            onDescriptionChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.description !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.description}</p>
        ) : null}
      </Label>
      <Label
        className="grid gap-1 text-sm"
        htmlFor={`${idPrefix}-soldiers-per-unit`}
      >
        <span className="text-muted-foreground">Soldiers per unit</span>
        <Input
          aria-invalid={fieldErrors.soldiersPerUnit !== undefined}
          disabled={disabled}
          id={`${idPrefix}-soldiers-per-unit`}
          inputMode="numeric"
          placeholder={soldiersPerUnitPlaceholder}
          value={soldiersPerUnit}
          onChange={(e) => {
            onSoldiersPerUnitChange(e.currentTarget.value);
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
        htmlFor={`${idPrefix}-desertion-rate`}
      >
        <span className="text-muted-foreground">
          Desertion rate (0–1 per unpaid turn)
        </span>
        <Input
          aria-invalid={fieldErrors.desertionRate !== undefined}
          disabled={disabled}
          id={`${idPrefix}-desertion-rate`}
          inputMode="decimal"
          placeholder={desertionRatePlaceholder}
          value={desertionRate}
          onChange={(e) => {
            onDesertionRateChange(e.currentTarget.value);
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
        htmlFor={`${idPrefix}-required-education-level`}
      >
        <span className="text-muted-foreground">Required education level</span>
        <NativeSelect
          aria-invalid={fieldErrors.requiredEducationLevelId !== undefined}
          disabled={disabled}
          id={`${idPrefix}-required-education-level`}
          value={requiredEducationLevelId}
          onChange={(e) => {
            onEducationLevelChange(e.currentTarget.value);
          }}
        >
          <option value="">None</option>
          {educationLevels.map((level) => (
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
        htmlFor={`${idPrefix}-required-blueprint`}
      >
        <span className="text-muted-foreground">Required building</span>
        <NativeSelect
          aria-invalid={fieldErrors.requiredBuildingBlueprintId !== undefined}
          disabled={disabled}
          id={`${idPrefix}-required-blueprint`}
          value={requiredBuildingBlueprintId}
          onChange={(e) => {
            onBlueprintChange(e.currentTarget.value);
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
          htmlFor={`${idPrefix}-required-tier`}
        >
          <span className="text-muted-foreground">Minimum building tier</span>
          <NativeSelect
            aria-invalid={fieldErrors.requiredBuildingTierNumber !== undefined}
            disabled={disabled || tiersPending}
            id={`${idPrefix}-required-tier`}
            value={requiredBuildingTierNumber}
            onChange={(e) => {
              onTierChange(e.currentTarget.value);
            }}
          >
            <option value="">Select tier</option>
            {tiers.map((tier) => (
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
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.recruitmentCostsJson}
        label="Recruitment cost (per soldier)"
        rows={recruitmentRows}
        onChange={onRecruitmentRowsChange}
      />
      <CostEditor
        activeResources={activeResources}
        disabled={disabled}
        error={fieldErrors.upkeepCostsJson}
        label="Upkeep cost (per soldier, per turn)"
        rows={upkeepRows}
        onChange={onUpkeepRowsChange}
      />
    </div>
  );
}
