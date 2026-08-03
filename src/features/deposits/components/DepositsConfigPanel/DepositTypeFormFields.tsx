import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { PaletteSlotPicker } from "@/components/shared/PaletteSlotPicker";
import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type JobDefinition } from "@/features/jobs";
import { type Resource } from "@/features/resources";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { depositInputLimits } from "@/lib/inputLimits";

import { DepositTypeJobRow } from "./DepositTypeJobRow";
import { type DepositTypeJobRowState } from "./hooks/UseDepositTypeJobRows";

import type { JSX } from "react";

export type DepositTypeFieldErrors = {
  readonly jobs?: string;
  readonly name?: string;
  readonly slug?: string;
};

export function DepositTypeFormFields({
  addRow,
  depositJobs,
  disabled,
  duplicateJobIds,
  fieldErrors,
  icon,
  iconColor,
  idPrefix,
  name,
  onIconChange,
  onIconColorChange,
  onNameChange,
  removeRow,
  resources,
  rows,
  slug,
  updateRow,
  worldId,
}: {
  readonly addRow: () => void;
  readonly depositJobs: readonly JobDefinition[];
  readonly disabled: boolean;
  readonly duplicateJobIds: ReadonlySet<string>;
  readonly fieldErrors: DepositTypeFieldErrors;
  readonly icon: string | null;
  readonly iconColor: CategoricalSlot | null;
  readonly idPrefix: string;
  readonly name: string;
  readonly onIconChange: (value: string | null) => void;
  readonly onIconColorChange: (value: CategoricalSlot | null) => void;
  readonly onNameChange: (value: string) => void;
  readonly removeRow: (localId: string) => void;
  readonly resources: readonly Resource[];
  readonly rows: readonly DepositTypeJobRowState[];
  readonly slug: string;
  readonly updateRow: (
    localId: string,
    patch: Partial<Omit<DepositTypeJobRowState, "localId">>,
  ) => void;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
      <Label htmlFor={`${idPrefix}-name`} className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          id={`${idPrefix}-name`}
          aria-invalid={fieldErrors.name !== undefined}
          aria-label="Name"
          disabled={disabled}
          maxLength={depositInputLimits.depositTypeNameMax}
          value={name}
          onChange={(e) => {
            onNameChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.name !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        ) : null}
        <SlugHint slug={slug} error={fieldErrors.slug} />
      </Label>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Icon</span>
        <IconPicker disabled={disabled} value={icon} onChange={onIconChange} />
      </Label>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Icon color</span>
        <PaletteSlotPicker
          disabled={disabled}
          value={iconColor}
          onChange={onIconColorChange}
        />
      </Label>
      {depositJobs.length === 0 ? (
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Linked jobs</span>
          <EmptyState
            title="No deposit jobs yet"
            description="Create one to assign to this deposit type."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/worlds/$worldId/configuration"
                  params={{ worldId }}
                  search={{ tab: "jobs" }}
                >
                  Create deposit job
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Linked jobs</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={addRow}
            >
              <Plus aria-hidden="true" />
              Add job
            </Button>
          </div>
          {fieldErrors.jobs !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.jobs}</p>
          ) : null}
          {rows.map((row, index) => (
            <DepositTypeJobRow
              key={row.localId}
              canRemove={rows.length > 1}
              disabled={disabled}
              depositJobs={depositJobs}
              index={index}
              isDuplicate={duplicateJobIds.has(row.jobId)}
              jobId={row.jobId}
              outputUnitsPerWorker={row.outputUnitsPerWorker}
              resources={resources}
              workerInputs={row.workerInputs}
              onJobIdChange={(jobId) => {
                updateRow(row.localId, { jobId });
              }}
              onOutputUnitsPerWorkerChange={(outputUnitsPerWorker) => {
                updateRow(row.localId, { outputUnitsPerWorker });
              }}
              onRemove={() => {
                removeRow(row.localId);
              }}
              onWorkerInputsChange={(workerInputs) => {
                updateRow(row.localId, { workerInputs });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
