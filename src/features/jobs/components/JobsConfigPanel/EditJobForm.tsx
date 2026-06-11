import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "@/components/shared/ResourceAmountListEditor";
import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { activeDepositTypesByWorldQueryOptions } from "@/features/deposits";
import {
  activeManagedPopulationTypesByWorldQueryOptions,
  type ManagedPopulationType,
} from "@/features/managed-populations";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { jobInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  softDeleteJobMutationOptions,
  updateJobMutationOptions,
} from "../../mutations/jobsMutations";
import {
  updateJobInputSchema,
  type UpdateJobInput,
} from "../../schemas/jobSchemas";
import { validateJobReferencesAgainstWorld } from "../../utils/validateJobReferences";

import { entryToRow, rowToEntry, type FieldErrors } from "./JobFormState";

import type { JobDefinition } from "../../types/jobTypes";

export function EditJobForm({
  job,
  onClose,
  queryClient,
  worldId,
}: {
  readonly job: JobDefinition;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(updateJobMutationOptions({ queryClient }));
  const softDeleteMutation = useMutation(
    softDeleteJobMutationOptions({ queryClient }),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const depositTypesQuery = useQuery(
    activeDepositTypesByWorldQueryOptions(worldId),
  );
  const managedPopTypesQuery = useQuery(
    activeManagedPopulationTypesByWorldQueryOptions(worldId),
  );

  const [name, setName] = useState(job.name);
  const [slug, setSlug] = useState(job.slug);

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(toSlug(value, { maxLength: jobInputLimits.jobSlugMax }));
  }

  const [baseCapacity, setBaseCapacity] = useState(
    job.baseCapacity !== null ? String(job.baseCapacity) : "0",
  );
  const [traderCapacityPerWorker, setTraderCapacityPerWorker] = useState(
    job.traderCapacityPerWorker !== null
      ? String(job.traderCapacityPerWorker)
      : "",
  );
  const [linkedDepositTypeId, setLinkedDepositTypeId] = useState(
    job.linkedDepositTypeId ?? "",
  );
  const [linkedManagedPopulationTypeId, setLinkedManagedPopulationTypeId] =
    useState(job.linkedManagedPopulationTypeId ?? "");
  const [inputRows, setInputRows] = useState<ResourceAmountEntry[]>(() =>
    job.inputsJson.map(entryToRow),
  );
  const [outputRows, setOutputRows] = useState<ResourceAmountEntry[]>(() =>
    job.outputsJson.map(entryToRow),
  );
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof FieldErrors>();

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;
  const resources = resourcesQuery.data ?? [];
  const activeDepositTypes = depositTypesQuery.data ?? [];
  const allManagedPopTypes = managedPopTypesQuery.data ?? [];

  // Scope managed pop type options to types that designate this job in the
  // corresponding slot (husbandry_job_id or culling_job_id).
  const availableManagedPopTypes: readonly ManagedPopulationType[] =
    job.jobType === "husbandry"
      ? allManagedPopTypes.filter((mpt) => mpt.husbandryJobId === job.id)
      : job.jobType === "culling"
        ? allManagedPopTypes.filter((mpt) => mpt.cullingJobId === job.id)
        : [];

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const inputsJson =
      job.jobType === "standard" ? inputRows.map(rowToEntry) : [];
    const outputsJson =
      job.jobType === "standard" ? outputRows.map(rowToEntry) : [];

    // Reference validation before Zod to surface deleted-resource errors as
    // inline errors rather than generic "invalid" messages.
    const linkedTypes: readonly { id: string }[] =
      job.jobType === "deposit" ? activeDepositTypes : availableManagedPopTypes;

    const refIssues = validateJobReferencesAgainstWorld(
      {
        inputsJson,
        linkedDepositTypeId:
          job.jobType === "deposit"
            ? linkedDepositTypeId !== ""
              ? linkedDepositTypeId
              : null
            : undefined,
        linkedManagedPopulationTypeId:
          job.jobType === "husbandry" || job.jobType === "culling"
            ? linkedManagedPopulationTypeId !== ""
              ? linkedManagedPopulationTypeId
              : null
            : undefined,
        outputsJson,
      },
      resources,
      linkedTypes,
    );

    if (refIssues.length > 0) {
      // Handle custom validation errors - these don't come from Zod
      // Just return without setting errors for now
      // Consider updating validateJobReferencesAgainstWorld to return Zod-compatible errors
      return;
    }

    const updateInput: UpdateJobInput = {
      baseCapacity:
        job.jobType === "standard" || job.jobType === "construction"
          ? baseCapacity !== ""
            ? parseInt(baseCapacity, 10)
            : undefined
          : undefined,
      inputsJson,
      jobId: job.id,
      linkedDepositTypeId:
        job.jobType === "deposit"
          ? linkedDepositTypeId !== ""
            ? linkedDepositTypeId
            : null
          : undefined,
      linkedManagedPopulationTypeId:
        job.jobType === "husbandry" || job.jobType === "culling"
          ? linkedManagedPopulationTypeId !== ""
            ? linkedManagedPopulationTypeId
            : null
          : undefined,
      name,
      outputsJson,
      slug,
      traderCapacityPerWorker:
        job.jobType === "trader"
          ? traderCapacityPerWorker !== ""
            ? parseInt(traderCapacityPerWorker, 10)
            : undefined
          : undefined,
      worldId,
    };

    const result = updateJobInputSchema.safeParse(updateInput);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Job saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save job.");
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      await softDeleteMutation.mutateAsync({ jobId: job.id, worldId });
      notifyMutationSuccess("Job moved to trash.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to move job to trash.");
    }
  }

  return (
    <form
      aria-label="Edit job"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit job</h3>
      <div className="grid gap-3">
        <Label htmlFor="edit-job-name" className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
            id="edit-job-name"
            aria-invalid={fieldErrors.name !== undefined}
            aria-label="Name"
            disabled={isPending}
            maxLength={jobInputLimits.jobNameMax}
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

        {job.jobType === "standard" || job.jobType === "construction" ? (
          <Label htmlFor="edit-job-basecapacity" className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Base capacity</span>
            <Input
              id="edit-job-basecapacity"
              aria-invalid={fieldErrors.baseCapacity !== undefined}
              disabled={isPending}
              inputMode="numeric"
              placeholder="0"
              value={baseCapacity}
              onChange={(e) => {
                setBaseCapacity(e.currentTarget.value);
              }}
            />
            {fieldErrors.baseCapacity !== undefined ? (
              <p className="text-xs text-destructive">
                {fieldErrors.baseCapacity}
              </p>
            ) : null}
          </Label>
        ) : null}

        {job.jobType === "trader" ? (
          <Label htmlFor="edit-job-trader" className="grid gap-1 text-sm">
            <span className="text-muted-foreground">
              Trader capacity per worker
            </span>
            <Input
              id="edit-job-trader"
              aria-invalid={fieldErrors.traderCapacityPerWorker !== undefined}
              disabled={isPending}
              inputMode="numeric"
              placeholder="0"
              value={traderCapacityPerWorker}
              onChange={(e) => {
                setTraderCapacityPerWorker(e.currentTarget.value);
              }}
            />
            {fieldErrors.traderCapacityPerWorker !== undefined ? (
              <p className="text-xs text-destructive">
                {fieldErrors.traderCapacityPerWorker}
              </p>
            ) : null}
          </Label>
        ) : null}

        {job.jobType === "deposit" ? (
          <Label htmlFor="edit-job-deposit" className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Linked deposit type</span>
            <NativeSelect
              id="edit-job-deposit"
              className="w-full"
              disabled={isPending}
              value={linkedDepositTypeId}
              onChange={(e) => {
                setLinkedDepositTypeId(e.currentTarget.value);
              }}
            >
              <option value="">None</option>
              {activeDepositTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
        ) : null}

        {job.jobType === "husbandry" || job.jobType === "culling" ? (
          <Label htmlFor="edit-job-managedpop" className="grid gap-1 text-sm">
            <span className="text-muted-foreground">
              Linked managed population type
            </span>
            <NativeSelect
              id="edit-job-managedpop"
              className="w-full"
              disabled={isPending}
              value={linkedManagedPopulationTypeId}
              onChange={(e) => {
                setLinkedManagedPopulationTypeId(e.currentTarget.value);
              }}
            >
              <option value="">None</option>
              {availableManagedPopTypes.map((mpt) => (
                <option key={mpt.id} value={mpt.id}>
                  {mpt.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
        ) : null}

        {job.jobType === "standard" ? (
          <>
            <ResourceAmountListEditor
              addLabel="Add input"
              amountLabel="amount per worker"
              disabled={isPending}
              entries={inputRows}
              fieldError={fieldErrors.inputsJson}
              label="Inputs"
              resources={resources}
              showNotes={true}
              onChange={setInputRows}
            />

            <ResourceAmountListEditor
              addLabel="Add output"
              amountLabel="amount per worker"
              disabled={isPending}
              entries={outputRows}
              fieldError={fieldErrors.outputsJson}
              label="Outputs"
              resources={resources}
              showNotes={true}
              onChange={setOutputRows}
            />
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
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
      </div>
    </form>
  );
}
