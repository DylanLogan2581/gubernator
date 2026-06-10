import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "@/components/shared/ResourceAmountListEditor";
import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { type JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { depositInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { sortByName } from "@/lib/sortUtils";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  softDeleteDepositTypeMutationOptions,
  updateDepositTypeMutationOptions,
} from "../../mutations/depositsMutations";
import {
  updateDepositTypeInputSchema,
  type UpdateDepositTypeInput,
} from "../../schemas/depositSchemas";

import { useDepositTypeJobLink } from "./hooks/UseDepositTypeJobLink";
import { toWorkerInputsEntries } from "./utils/WorkerInputsUtils";

import type { DepositType } from "../../types/depositTypes";

type DepositTypeFieldErrors = {
  readonly jobId?: string;
  readonly name?: string;
  readonly outputUnitsPerWorker?: string;
  readonly slug?: string;
};

export function EditDepositTypeForm({
  allDepositTypes,
  depositJobs,
  depositType,
  onClose,
  queryClient,
  worldId,
}: {
  readonly allDepositTypes: readonly DepositType[];
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
  const [outputUnitsPerWorker, setOutputUnitsPerWorker] = useState(
    String(depositType.outputUnitsPerWorker),
  );
  const [workerInputs, setWorkerInputs] = useState<ResourceAmountEntry[]>(() =>
    toWorkerInputsEntries(depositType.workerInputsJson),
  );
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof DepositTypeFieldErrors>();
  const { jobId, jobLinkError, handleJobChange } = useDepositTypeJobLink(
    allDepositTypes,
    depositType.id,
    depositType.jobId,
  );

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

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

    if (jobLinkError !== undefined) return;

    const updateInput: UpdateDepositTypeInput = {
      depositTypeId: depositType.id,
      jobId,
      name,
      outputUnitsPerWorker:
        outputUnitsPerWorker !== ""
          ? parseInt(outputUnitsPerWorker, 10)
          : undefined,
      slug,
      workerInputsJson: workerInputs.map((e) => ({
        amountPerWorker: parseFloat(e.amount),
        resourceId: e.resourceId,
      })),
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
    <form
      aria-label="Edit deposit type"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit deposit type</h3>
      <div className="grid gap-3">
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
        {depositJobs.length === 0 ? (
          <div className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Linked deposit job</span>
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
          <Label htmlFor="deposit-edit-job" className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Linked deposit job</span>
            <NativeSelect
              id="deposit-edit-job"
              aria-invalid={
                fieldErrors.jobId !== undefined || jobLinkError !== undefined
              }
              className="w-full"
              disabled={isPending}
              value={jobId}
              onChange={(e) => {
                handleJobChange(e.currentTarget.value);
              }}
            >
              <option value="">Select a deposit job…</option>
              {sortByName(depositJobs).map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </NativeSelect>
            {jobLinkError !== undefined ? (
              <p className="text-xs text-destructive">{jobLinkError}</p>
            ) : fieldErrors.jobId !== undefined ? (
              <p className="text-xs text-destructive">{fieldErrors.jobId}</p>
            ) : null}
          </Label>
        )}
        <Label htmlFor="deposit-edit-output" className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Output units per worker</span>
          <Input
            id="deposit-edit-output"
            aria-invalid={fieldErrors.outputUnitsPerWorker !== undefined}
            disabled={isPending}
            inputMode="numeric"
            placeholder="1"
            value={outputUnitsPerWorker}
            onChange={(e) => {
              setOutputUnitsPerWorker(e.currentTarget.value);
            }}
          />
          {fieldErrors.outputUnitsPerWorker !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.outputUnitsPerWorker}
            </p>
          ) : null}
        </Label>
        <ResourceAmountListEditor
          addLabel="Add input"
          amountLabel="amount per worker"
          disabled={isPending}
          entries={workerInputs}
          label="Worker inputs"
          resources={resources}
          onChange={setWorkerInputs}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={isPending || jobLinkError !== undefined}
          >
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
