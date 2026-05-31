import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "@/components/shared/ResourceAmountListEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { activeDepositTypesByWorldQueryOptions } from "@/features/deposits";
import {
  createJobInputSchema,
  createJobMutationOptions,
  hardDeleteJobMutationOptions,
  jobsByWorldQueryOptions,
  restoreJobMutationOptions,
  softDeleteJobMutationOptions,
  updateJobInputSchema,
  updateJobMutationOptions,
  validateJobReferencesAgainstWorld,
  type CreateJobInput,
  type JobDefinition,
  type JobIoEntry,
  type JobType,
  type UpdateJobInput,
} from "@/features/jobs";
import {
  activeManagedPopulationTypesByWorldQueryOptions,
  type ManagedPopulationType,
} from "@/features/managed-populations";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { jobInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const JOB_TYPES: readonly { label: string; value: JobType }[] = [
  { label: "Standard", value: "standard" },
  { label: "Construction", value: "construction" },
  { label: "Deposit", value: "deposit" },
  { label: "Husbandry", value: "husbandry" },
  { label: "Culling", value: "culling" },
  { label: "Trader", value: "trader" },
];

const JOB_TYPE_LABELS: Record<JobType, string> = {
  construction: "Construction",
  culling: "Culling",
  deposit: "Deposit",
  husbandry: "Husbandry",
  standard: "Standard",
  trader: "Trader",
};

type WorldJobsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldJobsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: WorldJobsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const jobsQuery = useQuery(jobsByWorldQueryOptions(worldId));

  if (jobsQuery.isPending) {
    return (
      <section
        aria-labelledby="world-jobs-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading jobs…" />
      </section>
    );
  }

  if (jobsQuery.isError) {
    return (
      <section
        aria-labelledby="world-jobs-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Jobs could not be loaded"
          description={getErrorDescription(jobsQuery.error)}
        />
      </section>
    );
  }

  const allJobs = jobsQuery.data;
  const visibleJobs = showTrash
    ? allJobs.filter((job) => job.isTrashed)
    : allJobs.filter((job) => !job.isTrashed);

  return (
    <WorldJobsConfigPanelContent
      canAdmin={canAdmin}
      isArchived={isArchived}
      jobs={visibleJobs}
      queryClient={queryClient}
      showTrash={showTrash}
      worldId={worldId}
      onToggleTrash={() => {
        setShowTrash((v) => !v);
      }}
    />
  );
}

function WorldJobsConfigPanelContent({
  canAdmin,
  isArchived,
  jobs,
  queryClient,
  showTrash,
  worldId,
  onToggleTrash,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly jobs: readonly JobDefinition[];
  readonly onToggleTrash: () => void;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  const createMutation = useMutation(createJobMutationOptions({ queryClient }));
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const canEdit = canAdmin && !isArchived;

  const filteredJobs =
    typeFilter === "all"
      ? jobs
      : jobs.filter((job) => job.jobType === typeFilter);

  return (
    <section
      aria-labelledby="world-jobs-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-center justify-between">
        <h2
          id="world-jobs-title"
          className="text-lg font-semibold tracking-normal"
        >
          Jobs
        </h2>
        <div className="flex items-center gap-2">
          {canEdit && !showForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add job
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showTrash ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={showTrash ? "Hide trash" : "Show trash"}
            aria-pressed={showTrash}
            title={showTrash ? "Hide trash" : "Show trash"}
            onClick={onToggleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter by job type"
        className="flex flex-wrap gap-1"
      >
        <button
          type="button"
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition-colors",
            typeFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
          onClick={() => {
            setTypeFilter("all");
          }}
        >
          All types
        </button>
        {JOB_TYPES.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              typeFilter === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
            onClick={() => {
              setTypeFilter(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredJobs.length > 0 ? (
        <JobList
          canEdit={canEdit}
          editingJobId={editingJobId}
          jobs={filteredJobs}
          queryClient={queryClient}
          showTrash={showTrash}
          worldId={worldId}
          onEditingChange={setEditingJobId}
        />
      ) : showTrash ? (
        <EmptyState title="No jobs in trash" />
      ) : typeFilter !== "all" ? (
        <EmptyState
          title={`No ${JOB_TYPE_LABELS[typeFilter].toLowerCase()} jobs`}
        />
      ) : !showForm ? (
        <EmptyState
          title="No jobs yet"
          description="Add the first job for this world."
        />
      ) : null}

      {canEdit && showForm && !showTrash ? (
        <CreateJobForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input) => {
            createMutation.mutate(input, {
              onError: (error) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to create job.",
                );
              },
              onSuccess: () => {
                notifyMutationSuccess("Job created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </section>
  );
}

function JobList({
  canEdit,
  editingJobId,
  jobs,
  queryClient,
  showTrash,
  worldId,
  onEditingChange,
}: {
  readonly canEdit: boolean;
  readonly editingJobId: string | null;
  readonly jobs: readonly JobDefinition[];
  readonly onEditingChange: (id: string | null) => void;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  return (
    <ul aria-label="Jobs" className="grid gap-2">
      {jobs.map((job) => {
        if (showTrash) {
          return (
            <TrashedJobRow
              key={job.id}
              job={job}
              queryClient={queryClient}
              worldId={worldId}
            />
          );
        }
        return editingJobId === job.id ? (
          <li key={job.id}>
            <EditJobForm
              job={job}
              queryClient={queryClient}
              worldId={worldId}
              onClose={() => {
                onEditingChange(null);
              }}
            />
          </li>
        ) : (
          <JobRow
            key={job.id}
            canEdit={canEdit}
            job={job}
            queryClient={queryClient}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(job.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function JobRow({
  canEdit,
  job,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly job: JobDefinition;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteJobMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to move job to trash.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Job moved to trash.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{job.name}</span>
          <Badge variant="secondary">{JOB_TYPE_LABELS[job.jobType]}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <JobCapacityDisplay job={job} />
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Move ${job.name} to trash`}
            title="Move to trash"
            disabled={softDeleteMutation.isPending}
            onClick={handleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function TrashedJobRow({
  job,
  queryClient,
  worldId,
}: {
  readonly job: JobDefinition;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreJobMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteJobMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to restore job.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Job restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { jobId: job.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to permanently delete job.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Job permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{job.name}</span>
          <Badge variant="secondary">{JOB_TYPE_LABELS[job.jobType]}</Badge>
          <Badge variant="outline">trashed</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleRestore}
        >
          Restore
        </Button>
        {job.hasActiveReferences ? (
          <span title="Cannot permanently delete: this job is still referenced by deposit types or managed population types.">
            <Button type="button" variant="destructive" size="sm" disabled>
              Delete permanently
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleHardDelete}
          >
            Delete permanently
          </Button>
        )}
      </div>
    </li>
  );
}

function JobCapacityDisplay({
  job,
}: {
  readonly job: JobDefinition;
}): JSX.Element | null {
  if (
    (job.jobType === "standard" || job.jobType === "construction") &&
    job.baseCapacity !== null
  ) {
    return (
      <span className="tabular-nums text-sm text-muted-foreground">
        {job.baseCapacity.toLocaleString()} capacity
      </span>
    );
  }
  if (job.jobType === "trader" && job.traderCapacityPerWorker !== null) {
    return (
      <span className="tabular-nums text-sm text-muted-foreground">
        {job.traderCapacityPerWorker.toLocaleString()} per worker
      </span>
    );
  }
  return null;
}

// Row type for the IO editor — uses raw string amounts to allow intermediate
// invalid states that Zod catches on submit.
function entryToRow(entry: JobIoEntry): ResourceAmountEntry {
  return {
    amount: String(entry.amountPerWorker),
    notes: entry.notes ?? "",
    resourceId: entry.resourceId,
  };
}

function rowToEntry(row: ResourceAmountEntry): {
  amountPerWorker: number;
  notes?: string;
  resourceId: string;
} {
  return {
    amountPerWorker: parseFloat(row.amount),
    ...(row.notes !== undefined && row.notes.trim() !== ""
      ? { notes: row.notes.trim() }
      : {}),
    resourceId: row.resourceId,
  };
}

type EditJobFieldErrors = {
  readonly baseCapacity?: string;
  readonly inputsJson?: string;
  readonly name?: string;
  readonly outputsJson?: string;
  readonly slug?: string;
  readonly traderCapacityPerWorker?: string;
};

function EditJobForm({
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
  const [baseCapacity, setBaseCapacity] = useState(
    job.baseCapacity !== null ? String(job.baseCapacity) : "",
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
  const [fieldErrors, setFieldErrors] = useState<EditJobFieldErrors>({});

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
    setFieldErrors({});

    const inputsJson =
      job.jobType === "construction" ? [] : inputRows.map(rowToEntry);
    const outputsJson =
      job.jobType === "construction" ? [] : outputRows.map(rowToEntry);

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
      const errors: Record<string, string> = {};
      for (const issue of refIssues) {
        if (!(issue.field in errors)) {
          errors[issue.field] = issue.message;
        }
      }
      setFieldErrors({
        inputsJson: errors.inputsJson,
        outputsJson: errors.outputsJson,
      });
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
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        baseCapacity: errors.baseCapacity,
        inputsJson: errors.inputsJson,
        name: errors.name,
        outputsJson: errors.outputsJson,
        slug: errors.slug,
        traderCapacityPerWorker: errors.traderCapacityPerWorker,
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Job saved.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save job.",
      );
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      await softDeleteMutation.mutateAsync({ jobId: job.id, worldId });
      notifyMutationSuccess("Job moved to trash.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to move job to trash.",
      );
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
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
            aria-invalid={fieldErrors.name !== undefined}
            disabled={isPending}
            maxLength={jobInputLimits.jobNameMax}
            value={name}
            onChange={(e) => {
              setName(e.currentTarget.value);
            }}
          />
          {fieldErrors.name !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          ) : null}
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Slug</span>
          <Input
            aria-invalid={fieldErrors.slug !== undefined}
            disabled={isPending}
            maxLength={jobInputLimits.jobSlugMax}
            value={slug}
            onChange={(e) => {
              setSlug(e.currentTarget.value);
            }}
          />
          {fieldErrors.slug !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.slug}</p>
          ) : null}
        </label>

        {job.jobType === "standard" || job.jobType === "construction" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Base capacity</span>
            <Input
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
          </label>
        ) : null}

        {job.jobType === "trader" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">
              Trader capacity per worker
            </span>
            <Input
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
          </label>
        ) : null}

        {job.jobType === "deposit" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Linked deposit type</span>
            <NativeSelect
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
          </label>
        ) : null}

        {job.jobType === "husbandry" || job.jobType === "culling" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">
              Linked managed population type
            </span>
            <NativeSelect
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
          </label>
        ) : null}

        {job.jobType !== "construction" ? (
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

type FieldErrors = {
  readonly baseCapacity?: string;
  readonly inputsJson?: string;
  readonly name?: string;
  readonly outputsJson?: string;
  readonly slug?: string;
  readonly traderCapacityPerWorker?: string;
};

function CreateJobForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateJobInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const resources = resourcesQuery.data ?? [];
  const [selectedType, setSelectedType] = useState<JobType | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [baseCapacity, setBaseCapacity] = useState("");
  const [traderCapacityPerWorker, setTraderCapacityPerWorker] = useState("");
  const [inputRows, setInputRows] = useState<ResourceAmountEntry[]>([]);
  const [outputRows, setOutputRows] = useState<ResourceAmountEntry[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleNameChange(value: string): void {
    setName(value);
    if (!slugEdited) {
      setSlug(toSlug(value));
    }
  }

  function handleSlugChange(value: string): void {
    setSlug(value);
    setSlugEdited(value.length > 0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (selectedType === null) return;
    setFieldErrors({});

    const inputsJson =
      selectedType === "standard" ? inputRows.map(rowToEntry) : undefined;
    const outputsJson =
      selectedType === "standard" ? outputRows.map(rowToEntry) : undefined;

    if (
      selectedType === "standard" &&
      inputsJson !== undefined &&
      outputsJson !== undefined
    ) {
      const refIssues = validateJobReferencesAgainstWorld(
        { inputsJson, outputsJson },
        resources,
      );
      if (refIssues.length > 0) {
        const errors: Record<string, string> = {};
        for (const issue of refIssues) {
          if (!(issue.field in errors)) {
            errors[issue.field] = issue.message;
          }
        }
        setFieldErrors({
          inputsJson: errors.inputsJson,
          outputsJson: errors.outputsJson,
        });
        return;
      }
    }

    let input: CreateJobInput;

    switch (selectedType) {
      case "standard":
        input = {
          baseCapacity:
            baseCapacity !== "" ? parseInt(baseCapacity, 10) : undefined,
          inputsJson,
          jobType: "standard",
          name,
          outputsJson,
          slug,
          worldId,
        };
        break;
      case "construction":
        input = {
          baseCapacity:
            baseCapacity !== "" ? parseInt(baseCapacity, 10) : undefined,
          inputsJson: [],
          jobType: "construction",
          name,
          outputsJson: [],
          slug,
          worldId,
        };
        break;
      case "trader":
        input = {
          jobType: "trader",
          name,
          slug,
          traderCapacityPerWorker:
            traderCapacityPerWorker !== ""
              ? parseInt(traderCapacityPerWorker, 10)
              : undefined,
          worldId,
        };
        break;
      case "deposit":
        input = {
          jobType: "deposit",
          linkedDepositTypeId: undefined,
          name,
          slug,
          worldId,
        };
        break;
      case "husbandry":
      case "culling":
        input = {
          jobType: selectedType,
          linkedManagedPopulationTypeId: undefined,
          name,
          slug,
          worldId,
        };
        break;
    }

    const result = createJobInputSchema.safeParse(input);
    if (!result.success) {
      let nameError: string | undefined;
      let slugError: string | undefined;
      let baseCapacityError: string | undefined;
      let traderCapacityPerWorkerError: string | undefined;
      let inputsJsonError: string | undefined;
      let outputsJsonError: string | undefined;
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "name") nameError ??= issue.message;
        else if (field === "slug") slugError ??= issue.message;
        else if (field === "baseCapacity") baseCapacityError ??= issue.message;
        else if (field === "traderCapacityPerWorker")
          traderCapacityPerWorkerError ??= issue.message;
        else if (field === "inputsJson") inputsJsonError ??= issue.message;
        else if (field === "outputsJson") outputsJsonError ??= issue.message;
      }
      setFieldErrors({
        baseCapacity: baseCapacityError,
        inputsJson: inputsJsonError,
        name: nameError,
        outputsJson: outputsJsonError,
        slug: slugError,
        traderCapacityPerWorker: traderCapacityPerWorkerError,
      });
      return;
    }

    onSubmit(input);
  }

  return (
    <form
      aria-label="Create job"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <h3 className="text-sm font-medium">New job</h3>
      <div className="grid gap-3">
        <fieldset>
          <legend className="mb-2 text-base font-semibold">Job type</legend>
          <div className="flex flex-wrap gap-3">
            {JOB_TYPES.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="jobType"
                  value={value}
                  checked={selectedType === value}
                  disabled={isPending}
                  onChange={() => {
                    setSelectedType(value);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {selectedType !== null ? (
          <>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
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
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Slug</span>
              <Input
                aria-invalid={fieldErrors.slug !== undefined}
                disabled={isPending}
                maxLength={jobInputLimits.jobSlugMax}
                value={slug}
                onChange={(e) => {
                  handleSlugChange(e.currentTarget.value);
                }}
              />
              {fieldErrors.slug !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.slug}</p>
              ) : null}
            </label>

            {selectedType === "standard" || selectedType === "construction" ? (
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Base capacity</span>
                <Input
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
              </label>
            ) : null}

            {selectedType === "trader" ? (
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  Trader capacity per worker
                </span>
                <Input
                  aria-invalid={
                    fieldErrors.traderCapacityPerWorker !== undefined
                  }
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
              </label>
            ) : null}

            {selectedType === "standard" ? (
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

            {selectedType === "deposit" ||
            selectedType === "husbandry" ||
            selectedType === "culling" ? (
              <p className="text-sm text-muted-foreground">
                You can link this job to a deposit type or managed population
                type after creating it from the relevant configuration tab.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={isPending || selectedType === null}
        >
          Create
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, jobInputLimits.jobSlugMax);
}
