import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { IconPicker } from "@/components/shared/iconPicker/IconPicker";
import { PaletteSlotPicker } from "@/components/shared/PaletteSlotPicker";
import { SlugHint } from "@/components/shared/SlugHint";
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
import { type JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { depositInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  softDeleteDepositTypeMutationOptions,
  updateDepositTypeMutationOptions,
} from "../../mutations/depositsMutations";
import {
  updateDepositTypeInputSchema,
  type UpdateDepositTypeInput,
} from "../../schemas/depositSchemas";

import { DepositTypeJobRow } from "./DepositTypeJobRow";
import {
  useDepositTypeJobRows,
  type DepositTypeJobRowState,
} from "./hooks/UseDepositTypeJobRows";
import { toWorkerInputsEntries } from "./utils/WorkerInputsUtils";

import type { DepositType } from "../../types/depositTypes";

type DepositTypeFieldErrors = {
  readonly jobs?: string;
  readonly name?: string;
  readonly slug?: string;
};

function toInitialRows(
  depositType: DepositType,
): readonly DepositTypeJobRowState[] {
  return depositType.jobs.map((job) => ({
    localId: job.id,
    jobId: job.jobId,
    outputUnitsPerWorker: String(job.outputUnitsPerWorker),
    workerInputs: toWorkerInputsEntries(job.workerInputsJson),
  }));
}

export function EditDepositTypeForm({
  depositJobs,
  depositType,
  onClose,
  queryClient,
  worldId,
}: {
  readonly depositJobs: readonly JobDefinition[];
  readonly depositType: DepositType;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(
    updateDepositTypeMutationOptions({ queryClient }),
  );
  const softDeleteMutation = useMutation(
    softDeleteDepositTypeMutationOptions({ queryClient }),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const [name, setName] = useState(depositType.name);
  const [slug, setSlug] = useState(depositType.slug);
  const [icon, setIcon] = useState<string | null>(depositType.icon);
  const [iconColor, setIconColor] = useState<CategoricalSlot | null>(
    depositType.iconColor as CategoricalSlot | null,
  );
  const { rows, addRow, removeRow, updateRow, duplicateJobIds } =
    useDepositTypeJobRows(toInitialRows(depositType));
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof DepositTypeFieldErrors>();

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;
  const hasEmptyJobSelection = rows.some((row) => row.jobId === "");
  const hasDuplicateJobs = duplicateJobIds.size > 0;

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(
      toSlug(value, { maxLength: depositInputLimits.depositTypeSlugMax }),
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    if (hasDuplicateJobs || hasEmptyJobSelection) return;

    const updateInput: UpdateDepositTypeInput = {
      depositTypeId: depositType.id,
      icon,
      iconColor,
      jobs: rows.map((row) => ({
        jobId: row.jobId,
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
      slug,
      worldId,
    };

    const result = updateDepositTypeInputSchema.safeParse(updateInput);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Deposit type saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save deposit type.");
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      await softDeleteMutation.mutateAsync({
        depositTypeId: depositType.id,
        worldId,
      });
      notifyMutationSuccess("Deposit type moved to trash.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to move deposit type to trash.");
    }
  }

  const resources = resourcesQuery.data ?? [];

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          aria-label="Edit deposit type"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit deposit type</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <Label htmlFor="deposit-edit-name" className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                id="deposit-edit-name"
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                maxLength={depositInputLimits.depositTypeNameMax}
                value={name}
                onChange={(e) => {
                  handleNameChange(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
              <SlugHint slug={slug} error={fieldErrors.slug} />
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
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                void handleTrash();
              }}
            >
              <Trash2 aria-hidden="true" />
              Move to trash
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
              <Button
                type="submit"
                size="sm"
                disabled={isPending || hasDuplicateJobs || hasEmptyJobSelection}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
