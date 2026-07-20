import { Trash2 } from "lucide-react";
import { type JSX } from "react";

import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "@/components/shared/ResourceAmountListEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";
import { sortByName } from "@/lib/sortUtils";

// One repeatable row in the deposit type job editor (#1246): a deposit type
// links 1..n jobs, each with its own output rate and worker inputs.
export function DepositTypeJobRow({
  canRemove,
  disabled,
  depositJobs,
  index,
  isDuplicate,
  isDuplicateTier,
  jobId,
  onJobIdChange,
  onOutputUnitsPerWorkerChange,
  onRemove,
  onTierNumberChange,
  onWorkerInputsChange,
  outputUnitsPerWorker,
  resources,
  tierNumber,
  workerInputs,
}: {
  readonly canRemove: boolean;
  readonly disabled: boolean;
  readonly depositJobs: readonly JobDefinition[];
  readonly index: number;
  readonly isDuplicate: boolean;
  readonly isDuplicateTier: boolean;
  readonly jobId: string;
  readonly onJobIdChange: (jobId: string) => void;
  readonly onOutputUnitsPerWorkerChange: (value: string) => void;
  readonly onRemove: () => void;
  readonly onTierNumberChange: (value: string) => void;
  readonly onWorkerInputsChange: (entries: ResourceAmountEntry[]) => void;
  readonly outputUnitsPerWorker: string;
  readonly resources: readonly Resource[];
  readonly tierNumber: string;
  readonly workerInputs: readonly ResourceAmountEntry[];
}): JSX.Element {
  const rowLabel = `Job ${String(index + 1)}`;

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
        htmlFor={`deposit-job-${String(index)}-select`}
        className="grid gap-1 text-sm"
      >
        <span className="text-muted-foreground">Linked job</span>
        <NativeSelect
          id={`deposit-job-${String(index)}-select`}
          aria-invalid={isDuplicate}
          aria-label={`${rowLabel} linked job`}
          className="w-full"
          disabled={disabled}
          value={jobId}
          onChange={(e) => {
            onJobIdChange(e.currentTarget.value);
          }}
        >
          <option value="">Select a deposit job…</option>
          {sortByName(depositJobs).map((job) => (
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
        htmlFor={`deposit-job-${String(index)}-tier`}
        className="grid gap-1 text-sm"
      >
        <span className="text-muted-foreground">Tier number</span>
        <Input
          id={`deposit-job-${String(index)}-tier`}
          aria-invalid={isDuplicateTier}
          aria-label={`${rowLabel} tier number`}
          disabled={disabled}
          inputMode="numeric"
          placeholder="1"
          value={tierNumber}
          onChange={(e) => {
            onTierNumberChange(e.currentTarget.value);
          }}
        />
        {isDuplicateTier ? (
          <p className="text-xs text-destructive">
            This tier number is already used in another row above.
          </p>
        ) : null}
      </Label>
      <Label
        htmlFor={`deposit-job-${String(index)}-output`}
        className="grid gap-1 text-sm"
      >
        <span className="text-muted-foreground">Output units per worker</span>
        <Input
          id={`deposit-job-${String(index)}-output`}
          aria-label={`${rowLabel} output units per worker`}
          disabled={disabled}
          inputMode="numeric"
          placeholder="1"
          value={outputUnitsPerWorker}
          onChange={(e) => {
            onOutputUnitsPerWorkerChange(e.currentTarget.value);
          }}
        />
      </Label>
      <ResourceAmountListEditor
        addLabel="Add input"
        amountLabel="amount per worker"
        disabled={disabled}
        entries={workerInputs}
        label={`${rowLabel} worker inputs`}
        resources={resources}
        onChange={onWorkerInputsChange}
      />
    </div>
  );
}
