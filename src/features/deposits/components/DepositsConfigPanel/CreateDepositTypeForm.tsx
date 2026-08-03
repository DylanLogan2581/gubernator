import { useQuery } from "@tanstack/react-query";
import { type FormEvent, type JSX, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import {
  DepositTypeFormFields,
  type DepositTypeFieldErrors,
} from "./DepositTypeFormFields";
import { useDepositTypeJobRows } from "./hooks/UseDepositTypeJobRows";

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
  const { rows, addRow, removeRow, updateRow, duplicateJobIds } =
    useDepositTypeJobRows();
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof DepositTypeFieldErrors>();

  const derivedSlug = toSlug(name, {
    maxLength: depositInputLimits.depositTypeSlugMax,
  });

  const hasEmptyJobSelection = rows.some((row) => row.jobId === "");
  const hasDuplicateJobs = duplicateJobIds.size > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    if (hasDuplicateJobs || hasEmptyJobSelection) return;

    const input: CreateDepositTypeInput = {
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
          <DepositTypeFormFields
            addRow={addRow}
            depositJobs={depositJobs}
            disabled={isPending}
            duplicateJobIds={duplicateJobIds}
            fieldErrors={fieldErrors}
            icon={icon}
            iconColor={iconColor}
            idPrefix="deposit-create"
            name={name}
            onIconChange={setIcon}
            onIconColorChange={setIconColor}
            onNameChange={setName}
            removeRow={removeRow}
            resources={resources}
            rows={rows}
            slug={derivedSlug}
            updateRow={updateRow}
            worldId={worldId}
          />
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
              disabled={isPending || hasDuplicateJobs || hasEmptyJobSelection}
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
