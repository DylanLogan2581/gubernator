import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type FormEvent, type JSX, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { PaletteSlotPicker } from "@/components/shared/PaletteSlotPicker";
import { SlugHint } from "@/components/shared/SlugHint";
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
import { type JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { depositInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createDepositTypeInputSchema,
  type CreateDepositTypeInput,
} from "../../schemas/depositSchemas";

import { DepositTypeJobRow } from "./DepositTypeJobRow";
import { useDepositTypeJobRows } from "./hooks/UseDepositTypeJobRows";

type DepositTypeFieldErrors = {
  readonly jobs?: string;
  readonly name?: string;
  readonly slug?: string;
};

export function CreateDepositTypeForm({
  depositJobs,
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly depositJobs: readonly JobDefinition[];
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateDepositTypeInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [iconColor, setIconColor] = useState<CategoricalSlot | null>(null);
  const {
    rows,
    addRow,
    removeRow,
    updateRow,
    duplicateJobIds,
    duplicateTierNumbers,
  } = useDepositTypeJobRows();
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof DepositTypeFieldErrors>();

  const derivedSlug = toSlug(name, {
    maxLength: depositInputLimits.depositTypeSlugMax,
  });

  const hasEmptyJobSelection = rows.some((row) => row.jobId === "");
  const hasDuplicateJobs = duplicateJobIds.size > 0;
  const hasDuplicateTiers = duplicateTierNumbers.size > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    if (hasDuplicateJobs || hasDuplicateTiers || hasEmptyJobSelection) return;

    const input: CreateDepositTypeInput = {
      icon,
      iconColor,
      jobs: rows.map((row) => ({
        jobId: row.jobId,
        tierNumber: row.tierNumber !== "" ? parseInt(row.tierNumber, 10) : 0,
        outputUnitsPerWorker:
          row.outputUnitsPerWorker !== ""
            ? parseInt(row.outputUnitsPerWorker, 10)
            : 0,
        workerInputsJson: row.workerInputs.map((e) => ({
          amountPerWorker: parseFloat(e.amount),
          resourceId: e.resourceId,
        })),
      })),
      name,
      slug: derivedSlug,
      worldId,
    };

    const result = createDepositTypeInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    onSubmit(input);
  }

  const resources = resourcesQuery.data ?? [];

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
            <DialogTitle>Create deposit type</DialogTitle>
            <DialogDescription>
              Define a deposit type and the jobs, worker settings, and resource
              outputs linked to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <Label htmlFor="deposit-create-name" className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                id="deposit-create-name"
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                maxLength={depositInputLimits.depositTypeNameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
              <SlugHint slug={derivedSlug} error={fieldErrors.slug} />
            </Label>
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Icon</span>
              <IconPicker
                disabled={isPending}
                value={icon}
                onChange={setIcon}
              />
            </Label>
            <Label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Icon color</span>
              <PaletteSlotPicker
                disabled={isPending}
                value={iconColor}
                onChange={setIconColor}
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
                  <span className="text-sm text-muted-foreground">
                    Linked jobs
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
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
                    disabled={isPending}
                    depositJobs={depositJobs}
                    index={index}
                    isDuplicate={duplicateJobIds.has(row.jobId)}
                    isDuplicateTier={duplicateTierNumbers.has(row.tierNumber)}
                    jobId={row.jobId}
                    outputUnitsPerWorker={row.outputUnitsPerWorker}
                    resources={resources}
                    tierNumber={row.tierNumber}
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
                    onTierNumberChange={(tierNumber) => {
                      updateRow(row.localId, { tierNumber });
                    }}
                    onWorkerInputsChange={(workerInputs) => {
                      updateRow(row.localId, { workerInputs });
                    }}
                  />
                ))}
              </div>
            )}
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
            <Button
              disabled={
                isPending ||
                hasDuplicateJobs ||
                hasDuplicateTiers ||
                hasEmptyJobSelection
              }
              type="submit"
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
