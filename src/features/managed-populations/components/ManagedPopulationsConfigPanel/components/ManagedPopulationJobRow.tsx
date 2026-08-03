import { Trash2 } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { type JobDefinition } from "@/features/jobs";
import { sortByName } from "@/lib/sortUtils";

// One repeatable row in the husbandry/culling job editors (#1247): a
// population type links 1..n jobs per purpose, each with its own rate
// (workers per N animals for husbandry, max cull per worker for culling).
export function ManagedPopulationJobRow({
  canRemove,
  disabled,
  fieldIdPrefix,
  index,
  isDuplicate,
  jobId,
  jobs,
  onJobIdChange,
  onRateValueChange,
  onRemove,
  purposeLabel,
  rateLabel,
  rateValue,
}: {
  readonly canRemove: boolean;
  readonly disabled: boolean;
  readonly fieldIdPrefix: string;
  readonly index: number;
  readonly isDuplicate: boolean;
  readonly jobId: string;
  readonly jobs: readonly JobDefinition[];
  readonly onJobIdChange: (jobId: string) => void;
  readonly onRateValueChange: (value: string) => void;
  readonly onRemove: () => void;
  readonly purposeLabel: string;
  readonly rateLabel: string;
  readonly rateValue: string;
}): JSX.Element {
  const rowLabel = `${purposeLabel} ${String(index + 1)}`;

  return (
    <div className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{rowLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${rowLabel}`}
          title="Remove job"
          disabled={disabled || !canRemove}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <Label
        htmlFor={`${fieldIdPrefix}-${String(index)}-select`}
        className="grid gap-1 text-sm"
      >
        <span className="text-muted-foreground">Linked job</span>
        <NativeSelect
          id={`${fieldIdPrefix}-${String(index)}-select`}
          aria-invalid={isDuplicate}
          aria-label={`${rowLabel} linked job`}
          className="w-full"
          disabled={disabled}
          value={jobId}
          onChange={(e) => {
            onJobIdChange(e.currentTarget.value);
          }}
        >
          <option value="">Select a job…</option>
          {sortByName(jobs).map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </NativeSelect>
        {isDuplicate ? (
          <p className="text-xs text-destructive">
            This job is already selected in another row above.
          </p>
        ) : null}
      </Label>
      <Label
        htmlFor={`${fieldIdPrefix}-${String(index)}-rate`}
        className="grid gap-1 text-sm"
      >
        <span className="text-muted-foreground">{rateLabel}</span>
        <Input
          id={`${fieldIdPrefix}-${String(index)}-rate`}
          aria-label={`${rowLabel} ${rateLabel}`}
          disabled={disabled}
          inputMode="numeric"
          placeholder="1"
          value={rateValue}
          onChange={(e) => {
            onRateValueChange(e.currentTarget.value);
          }}
        />
      </Label>
    </div>
  );
}
