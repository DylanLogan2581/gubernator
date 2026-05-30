import { Plus } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";
import { cn } from "@/lib/utils";

import type { CostRowState, EffectRowState } from "../utils/tierEditorUtils";

type EffectTypeName =
  | "job_capacity_increase"
  | "passive_resource_production"
  | "population_cap_increase"
  | "resource_storage_increase";

const EFFECT_TYPE_LABELS: Record<EffectTypeName, string> = {
  job_capacity_increase: "Job capacity increase",
  passive_resource_production: "Passive resource production",
  population_cap_increase: "Population cap increase",
  resource_storage_increase: "Resource storage increase",
};

const SELECT_CLASS = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base",
  "transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
  "md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
);

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
    onChange([
      ...rows,
      { amount: "", id: crypto.randomUUID(), resourceId: "" },
    ]);
  }

  function removeRow(id: string): void {
    onChange(rows.filter((r) => r.id !== id));
  }

  function updateRow(id: string, patch: Partial<CostRowState>): void {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`cost-resource-${row.id}`}>
            Resource
          </label>
          <select
            aria-label="Resource"
            className={SELECT_CLASS}
            disabled={disabled}
            id={`cost-resource-${row.id}`}
            value={row.resourceId}
            onChange={(e) => {
              updateRow(row.id, { resourceId: e.currentTarget.value });
            }}
          >
            <option value="">Select resource</option>
            {activeResources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
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
    </div>
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
        id: crypto.randomUUID(),
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
    <div className="grid gap-2">
      <span className="text-sm text-muted-foreground">Effects</span>
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid gap-2 rounded-md border border-border p-3"
        >
          <div className="flex items-start gap-2">
            <div className="grid flex-1 gap-2">
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Effect type</span>
                <select
                  aria-label="Effect type"
                  className={SELECT_CLASS}
                  disabled={disabled}
                  value={row.effectType}
                  onChange={(e) => {
                    updateRow(row.id, {
                      effectType: e.currentTarget.value,
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
                </select>
              </label>

              {row.effectType === "job_capacity_increase" ? (
                <>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Job</span>
                    <select
                      aria-label="Job"
                      className={SELECT_CLASS}
                      disabled={disabled}
                      value={row.jobId}
                      onChange={(e) => {
                        updateRow(row.id, { jobId: e.currentTarget.value });
                      }}
                    >
                      <option value="">Select job</option>
                      {activeJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <Input
                      aria-label="Effect amount"
                      disabled={disabled}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => {
                        updateRow(row.id, { amount: e.currentTarget.value });
                      }}
                    />
                  </label>
                </>
              ) : null}

              {row.effectType === "passive_resource_production" ||
              row.effectType === "resource_storage_increase" ? (
                <>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Resource</span>
                    <select
                      aria-label="Effect resource"
                      className={SELECT_CLASS}
                      disabled={disabled}
                      value={row.resourceId}
                      onChange={(e) => {
                        updateRow(row.id, {
                          resourceId: e.currentTarget.value,
                        });
                      }}
                    >
                      <option value="">Select resource</option>
                      {activeResources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <Input
                      aria-label="Effect amount"
                      disabled={disabled}
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => {
                        updateRow(row.id, { amount: e.currentTarget.value });
                      }}
                    />
                  </label>
                </>
              ) : null}

              {row.effectType === "population_cap_increase" ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <Input
                    aria-label="Effect amount"
                    disabled={disabled}
                    inputMode="numeric"
                    placeholder="0"
                    value={row.amount}
                    onChange={(e) => {
                      updateRow(row.id, { amount: e.currentTarget.value });
                    }}
                  />
                </label>
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
    </div>
  );
}
