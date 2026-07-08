import { Plus } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { type EducationLevel } from "@/features/education";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";
import { sortByName } from "@/lib/sortUtils";
import { generateLocalId } from "@/lib/uid";

import type { EffectTypeName } from "../types/buildingTypes";
import type {
  CostRowState,
  EducationConfigRowState,
  EffectRowState,
} from "../utils/tierEditorUtils";

const EFFECT_TYPE_LABELS: Record<EffectTypeName, string> = {
  job_capacity_increase: "Job capacity increase",
  passive_resource_production: "Passive resource production",
  population_cap_increase: "Population cap increase",
  resource_storage_increase: "Resource storage increase",
};

export function CostEditor({
  activeResources,
  disabled,
  error,
  label,
  rows,
  onChange,
}: {
  readonly activeResources: readonly Resource[];
  readonly disabled: boolean;
  readonly error?: string;
  readonly label: string;
  readonly rows: readonly CostRowState[];
  readonly onChange: (rows: CostRowState[]) => void;
}): JSX.Element {
  function addRow(): void {
    onChange([...rows, { amount: "", id: generateLocalId(), resourceId: "" }]);
  }

  function removeRow(id: string): void {
    onChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<CostRowState>): void {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm text-muted-foreground">{label}</legend>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Label className="sr-only" htmlFor={`cost-resource-${row.id}`}>
            Resource
          </Label>
          <NativeSelect
            aria-label="Resource"
            className="w-full"
            disabled={disabled}
            id={`cost-resource-${row.id}`}
            value={row.resourceId}
            onChange={(e) => {
              updateRow(row.id, { resourceId: e.currentTarget.value });
            }}
          >
            <option value="">Select resource</option>
            {sortByName(activeResources).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
          <Input
            aria-label="Amount"
            className="w-24 shrink-0"
            disabled={disabled}
            inputMode="numeric"
            placeholder="0"
            value={row.amount}
            onChange={(e) => {
              updateRow(row.id, { amount: e.currentTarget.value });
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              removeRow(row.id);
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      {error !== undefined ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={addRow}
      >
        <Plus aria-hidden="true" />
        Add cost
      </Button>
    </fieldset>
  );
}

export function EffectsEditor({
  activeJobs,
  activeResources,
  disabled,
  error,
  rows,
  onChange,
}: {
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly disabled: boolean;
  readonly error?: string;
  readonly rows: readonly EffectRowState[];
  readonly onChange: (rows: EffectRowState[]) => void;
}): JSX.Element {
  function addRow(): void {
    onChange([
      ...rows,
      {
        amount: "",
        effectType: "",
        id: generateLocalId(),
        jobId: "",
        resourceId: "",
      },
    ]);
  }

  function removeRow(id: string): void {
    onChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<EffectRowState>): void {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm text-muted-foreground">Effects</legend>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-2 rounded-md border border-border p-3"
        >
          <div className="flex items-start gap-2">
            <div className="grid flex-1 gap-2">
              <div className="grid gap-1">
                <Label htmlFor={`effect-type-${row.id}`}>Effect type</Label>
                <NativeSelect
                  id={`effect-type-${row.id}`}
                  aria-label="Effect type"
                  className="w-full"
                  disabled={disabled}
                  value={row.effectType}
                  onChange={(e) => {
                    updateRow(row.id, {
                      effectType: e.currentTarget.value as EffectTypeName | "",
                      jobId: "",
                      resourceId: "",
                    });
                  }}
                >
                  <option value="">Select type</option>
                  {(
                    Object.entries(EFFECT_TYPE_LABELS) as [
                      EffectTypeName,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {row.effectType === "job_capacity_increase" ? (
                <>
                  <div className="grid gap-1">
                    <Label htmlFor={`effect-job-${row.id}`}>Job</Label>
                    <NativeSelect
                      id={`effect-job-${row.id}`}
                      aria-label="Job"
                      className="w-full"
                      disabled={disabled}
                      value={row.jobId}
                      onChange={(e) => {
                        updateRow(row.id, { jobId: e.currentTarget.value });
                      }}
                    >
                      <option value="">Select job</option>
                      {sortByName(activeJobs).map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`effect-amount-${row.id}`}>Amount</Label>
                    <Input
                      id={`effect-amount-${row.id}`}
                      aria-label="Effect amount"
                      disabled={disabled}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => {
                        updateRow(row.id, { amount: e.currentTarget.value });
                      }}
                    />
                  </div>
                </>
              ) : null}

              {row.effectType === "passive_resource_production" ||
              row.effectType === "resource_storage_increase" ? (
                <>
                  <div className="grid gap-1">
                    <Label htmlFor={`effect-resource-${row.id}`}>
                      Resource
                    </Label>
                    <NativeSelect
                      id={`effect-resource-${row.id}`}
                      aria-label="Effect resource"
                      className="w-full"
                      disabled={disabled}
                      value={row.resourceId}
                      onChange={(e) => {
                        updateRow(row.id, {
                          resourceId: e.currentTarget.value,
                        });
                      }}
                    >
                      <option value="">Select resource</option>
                      {sortByName(activeResources).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`effect-amount-res-${row.id}`}>
                      Amount
                    </Label>
                    <Input
                      id={`effect-amount-res-${row.id}`}
                      aria-label="Effect amount"
                      disabled={disabled}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => {
                        updateRow(row.id, { amount: e.currentTarget.value });
                      }}
                    />
                  </div>
                </>
              ) : null}

              {row.effectType === "population_cap_increase" ? (
                <div className="grid gap-1">
                  <Label htmlFor={`effect-amount-pop-${row.id}`}>Amount</Label>
                  <Input
                    id={`effect-amount-pop-${row.id}`}
                    aria-label="Effect amount"
                    disabled={disabled}
                    inputMode="numeric"
                    placeholder="0"
                    value={row.amount}
                    onChange={(e) => {
                      updateRow(row.id, { amount: e.currentTarget.value });
                    }}
                  />
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-6 shrink-0"
              disabled={disabled}
              onClick={() => {
                removeRow(row.id);
              }}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}
      {error !== undefined ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled}
        onClick={addRow}
      >
        <Plus aria-hidden="true" />
        Add effect
      </Button>
    </fieldset>
  );
}

export function EducationConfigEditor({
  activeEducationLevels,
  activeJobs,
  config,
  disabled,
  error,
  onChange,
}: {
  readonly activeEducationLevels: readonly EducationLevel[];
  readonly activeJobs: readonly JobDefinition[];
  readonly config: EducationConfigRowState;
  readonly disabled: boolean;
  readonly error?: string;
  readonly onChange: (config: EducationConfigRowState) => void;
}): JSX.Element {
  function update(patch: Partial<EducationConfigRowState>): void {
    onChange({ ...config, ...patch });
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm text-muted-foreground">Education</legend>
      <div className="flex items-center gap-2">
        <Switch
          id="tier-is-school"
          checked={config.isSchool}
          disabled={disabled}
          onCheckedChange={(isSchool) => {
            update({ isSchool });
          }}
        />
        <Label htmlFor="tier-is-school">This tier is a school</Label>
      </div>
      {config.isSchool ? (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <div className="grid gap-1">
            <Label htmlFor="tier-teaches-up-to-level">
              Teaches up to level
            </Label>
            <NativeSelect
              id="tier-teaches-up-to-level"
              aria-label="Teaches up to level"
              className="w-full"
              disabled={disabled}
              value={config.teachesUpToLevelId}
              onChange={(e) => {
                update({ teachesUpToLevelId: e.currentTarget.value });
              }}
            >
              <option value="">Select level</option>
              {activeEducationLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tier-student-capacity">Student capacity</Label>
            <Input
              id="tier-student-capacity"
              disabled={disabled}
              inputMode="numeric"
              placeholder="0"
              value={config.studentCapacity}
              onChange={(e) => {
                update({ studentCapacity: e.currentTarget.value });
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tier-turns-per-level">Turns per level</Label>
            <Input
              id="tier-turns-per-level"
              disabled={disabled}
              inputMode="numeric"
              placeholder="0"
              value={config.turnsPerLevel}
              onChange={(e) => {
                update({ turnsPerLevel: e.currentTarget.value });
              }}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tier-teacher-job">Teacher job</Label>
            <NativeSelect
              id="tier-teacher-job"
              aria-label="Teacher job"
              className="w-full"
              disabled={disabled}
              value={config.teacherJobId}
              onChange={(e) => {
                update({ teacherJobId: e.currentTarget.value });
              }}
            >
              <option value="">Select job</option>
              {sortByName(activeJobs).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tier-students-per-teacher">
              Students per teacher
            </Label>
            <Input
              id="tier-students-per-teacher"
              disabled={disabled}
              inputMode="numeric"
              placeholder="0"
              value={config.studentsPerTeacher}
              onChange={(e) => {
                update({ studentsPerTeacher: e.currentTarget.value });
              }}
            />
          </div>
        </div>
      ) : null}
      {error !== undefined ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </fieldset>
  );
}
