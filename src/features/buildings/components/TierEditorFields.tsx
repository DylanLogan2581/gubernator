import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { type EducationLevel } from "@/features/education";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";
import { sortByName } from "@/lib/sortUtils";
import { generateLocalId } from "@/lib/uid";

import type { EffectTypeName } from "../types/buildingTypes";
import type {
  CostRowState,
  EducationLevelTransitionRowState,
  EffectRowState,
} from "../utils/tierEditorUtils";

const EFFECT_TYPE_LABELS: Record<EffectTypeName, string> = {
  education: "Education",
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
  activeEducationLevels,
  activeJobs,
  activeResources,
  disabled,
  error,
  rows,
  worldId,
  onChange,
}: {
  readonly activeEducationLevels: readonly EducationLevel[];
  readonly activeJobs: readonly JobDefinition[];
  readonly activeResources: readonly Resource[];
  readonly disabled: boolean;
  readonly error?: string;
  readonly rows: readonly EffectRowState[];
  readonly worldId: string;
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
        levels: [],
        resourceId: "",
        studentsPerTeacher: "",
        teacherCapacity: "",
        teacherJobId: "",
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

              {row.effectType === "education" ? (
                <EducationEffectFields
                  activeEducationLevels={activeEducationLevels}
                  activeJobs={activeJobs}
                  disabled={disabled}
                  row={row}
                  worldId={worldId}
                  onChange={(patch) => {
                    updateRow(row.id, patch);
                  }}
                />
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

function EducationEffectFields({
  activeEducationLevels,
  activeJobs,
  disabled,
  row,
  worldId,
  onChange,
}: {
  readonly activeEducationLevels: readonly EducationLevel[];
  readonly activeJobs: readonly JobDefinition[];
  readonly disabled: boolean;
  readonly row: EffectRowState;
  readonly worldId: string;
  readonly onChange: (patch: Partial<EffectRowState>) => void;
}): JSX.Element {
  const teacherJobs = activeJobs.filter((j) => j.jobType === "teacher");

  function addLevel(): void {
    onChange({
      levels: [
        ...row.levels,
        { fromLevelId: "", id: generateLocalId(), toLevelId: "", turns: "" },
      ],
    });
  }

  function removeLevel(id: string): void {
    onChange({ levels: row.levels.filter((l) => l.id !== id) });
  }

  function updateLevel(
    id: string,
    patch: Partial<EducationLevelTransitionRowState>,
  ): void {
    onChange({
      levels: row.levels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  return (
    <>
      <div className="grid gap-1">
        <Label htmlFor={`effect-teacher-job-${row.id}`}>Teacher job</Label>
        <NativeSelect
          id={`effect-teacher-job-${row.id}`}
          aria-label="Teacher job"
          className="w-full"
          disabled={disabled}
          value={row.teacherJobId}
          onChange={(e) => {
            onChange({ teacherJobId: e.currentTarget.value });
          }}
        >
          <option value="">Select job</option>
          {sortByName(teacherJobs).map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`effect-teacher-capacity-${row.id}`}>
          Teacher capacity
        </Label>
        <Input
          id={`effect-teacher-capacity-${row.id}`}
          disabled={disabled}
          inputMode="numeric"
          placeholder="0"
          value={row.teacherCapacity}
          onChange={(e) => {
            onChange({ teacherCapacity: e.currentTarget.value });
          }}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`effect-students-per-teacher-${row.id}`}>
          Students per teacher
        </Label>
        <Input
          id={`effect-students-per-teacher-${row.id}`}
          disabled={disabled}
          inputMode="numeric"
          placeholder="0"
          value={row.studentsPerTeacher}
          onChange={(e) => {
            onChange({ studentsPerTeacher: e.currentTarget.value });
          }}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm text-muted-foreground">
          Level transitions
        </legend>
        {activeEducationLevels.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No education levels configured yet.{" "}
            <Link
              to="/worlds/$worldId/configuration"
              params={{ worldId }}
              search={{ tab: "education" }}
              className="text-primary hover:underline"
            >
              Add one in Configuration → Education
            </Link>{" "}
            to set up level transitions.
          </p>
        ) : (
          <>
            {row.levels.map((level) => (
              <div key={level.id} className="flex items-center gap-2">
                <Label className="sr-only" htmlFor={`level-from-${level.id}`}>
                  From level
                </Label>
                <NativeSelect
                  id={`level-from-${level.id}`}
                  aria-label="From level"
                  className="w-full"
                  disabled={disabled}
                  value={level.fromLevelId}
                  onChange={(e) => {
                    updateLevel(level.id, {
                      fromLevelId: e.currentTarget.value,
                    });
                  }}
                >
                  <option value="">No education</option>
                  {activeEducationLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </NativeSelect>
                <Label className="sr-only" htmlFor={`level-to-${level.id}`}>
                  To level
                </Label>
                <NativeSelect
                  id={`level-to-${level.id}`}
                  aria-label="To level"
                  className="w-full"
                  disabled={disabled}
                  value={level.toLevelId}
                  onChange={(e) => {
                    updateLevel(level.id, { toLevelId: e.currentTarget.value });
                  }}
                >
                  <option value="">Select level</option>
                  {activeEducationLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </NativeSelect>
                <Label className="sr-only" htmlFor={`level-turns-${level.id}`}>
                  Turns
                </Label>
                <Input
                  id={`level-turns-${level.id}`}
                  aria-label="Turns"
                  className="w-20 shrink-0"
                  disabled={disabled}
                  inputMode="numeric"
                  placeholder="0"
                  value={level.turns}
                  onChange={(e) => {
                    updateLevel(level.id, { turns: e.currentTarget.value });
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    removeLevel(level.id);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={disabled}
              onClick={addLevel}
            >
              <Plus aria-hidden="true" />
              Add transition
            </Button>
          </>
        )}
      </fieldset>
    </>
  );
}
