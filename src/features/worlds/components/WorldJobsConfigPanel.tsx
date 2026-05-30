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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeDepositTypesByWorldQueryOptions } from "@/features/deposits";
import {
  createJobInputSchema,
  createJobMutationOptions,
  jobsByWorldQueryOptions,
  setJobActiveMutationOptions,
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
import {
  activeResourcesByWorldQueryOptions,
  type Resource,
} from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { jobInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80";

const IO_ROW_SELECT_CLASS =
  "flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80";

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
  const [showArchived, setShowArchived] = useState(false);
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
  const visibleJobs = showArchived
    ? allJobs
    : allJobs.filter((job) => job.isActive);

  return (
    <WorldJobsConfigPanelContent
      canAdmin={canAdmin}
      isArchived={isArchived}
      jobs={visibleJobs}
      queryClient={queryClient}
      showArchived={showArchived}
      worldId={worldId}
      onToggleArchived={() => {
        setShowArchived((v) => !v);
      }}
    />
  );
}

function WorldJobsConfigPanelContent({
  canAdmin,
  isArchived,
  jobs,
  queryClient,
  showArchived,
  worldId,
  onToggleArchived,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly jobs: readonly JobDefinition[];
  readonly onToggleArchived: () => void;
  readonly queryClient: QueryClient;
  readonly showArchived: boolean;
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleArchived}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Button>
          {canEdit && !showForm ? (
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
          showArchived={showArchived}
          worldId={worldId}
          onEditingChange={setEditingJobId}
        />
      ) : typeFilter !== "all" ? (
        <p className="text-sm text-muted-foreground">
          No {JOB_TYPE_LABELS[typeFilter].toLowerCase()} jobs.
        </p>
      ) : !showForm ? (
        <EmptyState
          title="No jobs yet"
          description="Add the first job for this world."
        />
      ) : null}

      {canEdit && showForm ? (
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
  showArchived,
  worldId,
  onEditingChange,
}: {
  readonly canEdit: boolean;
  readonly editingJobId: string | null;
  readonly jobs: readonly JobDefinition[];
  readonly onEditingChange: (id: string | null) => void;
  readonly queryClient: QueryClient;
  readonly showArchived: boolean;
  readonly worldId: string;
}): JSX.Element {
  return (
    <ul aria-label="Jobs" className="grid gap-2">
      {jobs.map((job) =>
        editingJobId === job.id ? (
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
            showArchived={showArchived}
            onEdit={() => {
              onEditingChange(job.id);
            }}
          />
        ),
      )}
    </ul>
  );
}

function JobRow({
  canEdit,
  job,
  showArchived,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly job: JobDefinition;
  readonly onEdit: () => void;
  readonly showArchived: boolean;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{job.name}</span>
          <Badge variant="secondary">{JOB_TYPE_LABELS[job.jobType]}</Badge>
          {showArchived && !job.isActive ? (
            <Badge variant="outline">archived</Badge>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{job.slug}</span>
      </div>
      <div className="flex items-center gap-3">
        <JobCapacityDisplay job={job} />
        {canEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
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
type IoRow = {
  amountRaw: string;
  notes: string;
  resourceId: string;
};

function entryToRow(entry: JobIoEntry): IoRow {
  return {
    amountRaw: String(entry.amountPerWorker),
    notes: entry.notes ?? "",
    resourceId: entry.resourceId,
  };
}

function rowToEntry(row: IoRow): {
  amountPerWorker: number;
  notes?: string;
  resourceId: string;
} {
  return {
    amountPerWorker: parseFloat(row.amountRaw),
    ...(row.notes.trim() !== "" ? { notes: row.notes.trim() } : {}),
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
  const setActiveMutation = useMutation(
    setJobActiveMutationOptions({ queryClient }),
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
  const [isActive, setIsActive] = useState(job.isActive);
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
  const [inputRows, setInputRows] = useState<IoRow[]>(() =>
    job.inputsJson.map(entryToRow),
  );
  const [outputRows, setOutputRows] = useState<IoRow[]>(() =>
    job.outputsJson.map(entryToRow),
  );
  const [fieldErrors, setFieldErrors] = useState<EditJobFieldErrors>({});

  const isPending = updateMutation.isPending || setActiveMutation.isPending;
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

    const inputsJson = inputRows.map(rowToEntry);
    const outputsJson = outputRows.map(rowToEntry);

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
      if (isActive !== job.isActive) {
        await setActiveMutation.mutateAsync({
          isActive,
          jobId: job.id,
          worldId,
        });
      }
      notifyMutationSuccess("Job saved.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save job.",
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
            <select
              className={SELECT_CLASS}
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
            </select>
          </label>
        ) : null}

        {job.jobType === "husbandry" || job.jobType === "culling" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">
              Linked managed population type
            </span>
            <select
              className={SELECT_CLASS}
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
            </select>
          </label>
        ) : null}

        <JobIoEditor
          disabled={isPending}
          fieldError={fieldErrors.inputsJson}
          label="Inputs"
          resources={resources}
          rows={inputRows}
          onChange={setInputRows}
        />

        <JobIoEditor
          disabled={isPending}
          fieldError={fieldErrors.outputsJson}
          label="Outputs"
          resources={resources}
          rows={outputRows}
          onChange={setOutputRows}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            disabled={isPending}
            onChange={(e) => {
              setIsActive(e.currentTarget.checked);
            }}
          />
          <span className="text-muted-foreground">Active</span>
        </label>
      </div>

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
    </form>
  );
}

function JobIoEditor({
  disabled,
  fieldError,
  label,
  onChange,
  resources,
  rows,
}: {
  readonly disabled: boolean;
  readonly fieldError?: string;
  readonly label: string;
  readonly onChange: (rows: IoRow[]) => void;
  readonly resources: readonly Resource[];
  readonly rows: IoRow[];
}): JSX.Element {
  const addLabel = label === "Inputs" ? "Add input" : "Add output";

  function handleAdd(): void {
    if (resources.length === 0) return;
    const usedIds = new Set(rows.map((r) => r.resourceId));
    const firstUnused = resources.find((r) => !usedIds.has(r.id));
    if (firstUnused === undefined) return;
    onChange([
      ...rows,
      { amountRaw: "1", notes: "", resourceId: firstUnused.id },
    ]);
  }

  function handleRemove(index: number): void {
    onChange(rows.filter((_, i) => i !== index));
  }

  function handleResourceChange(index: number, resourceId: string): void {
    onChange(rows.map((r, i) => (i === index ? { ...r, resourceId } : r)));
  }

  function handleAmountChange(index: number, value: string): void {
    onChange(
      rows.map((r, i) => (i === index ? { ...r, amountRaw: value } : r)),
    );
  }

  function handleNotesChange(index: number, value: string): void {
    onChange(rows.map((r, i) => (i === index ? { ...r, notes: value } : r)));
  }

  return (
    <fieldset className="grid gap-2">
      <div className="flex items-center justify-between">
        <legend className="text-sm text-muted-foreground">{label}</legend>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled ||
            resources.length === 0 ||
            rows.length >= resources.length
          }
          onClick={handleAdd}
        >
          <Plus aria-hidden="true" />
          {addLabel}
        </Button>
      </div>
      {fieldError !== undefined ? (
        <p className="text-xs text-destructive">{fieldError}</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="grid gap-2">
          {rows.map((row, index) => {
            const isDeletedResource = !resources.some(
              (r) => r.id === row.resourceId,
            );
            return (
              <li key={index} className="grid gap-1">
                <div className="flex items-center gap-2">
                  <select
                    aria-invalid={isDeletedResource}
                    aria-label={`${label} entry ${String(index + 1)} resource`}
                    className={IO_ROW_SELECT_CLASS}
                    disabled={disabled}
                    value={isDeletedResource ? "" : row.resourceId}
                    onChange={(e) => {
                      handleResourceChange(index, e.currentTarget.value);
                    }}
                  >
                    {isDeletedResource ? (
                      <option value="" disabled>
                        Deleted resource
                      </option>
                    ) : null}
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`${label} entry ${String(index + 1)} amount per worker`}
                    className="w-24 shrink-0"
                    disabled={disabled}
                    inputMode="decimal"
                    placeholder="1"
                    value={row.amountRaw}
                    onChange={(e) => {
                      handleAmountChange(index, e.currentTarget.value);
                    }}
                  />
                  <Input
                    aria-label={`${label} entry ${String(index + 1)} notes`}
                    className="flex-1 min-w-0"
                    disabled={disabled}
                    placeholder="Notes (optional)"
                    value={row.notes}
                    onChange={(e) => {
                      handleNotesChange(index, e.currentTarget.value);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove ${addLabel.slice(4)} entry ${String(index + 1)}`}
                    disabled={disabled}
                    onClick={() => {
                      handleRemove(index);
                    }}
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {isDeletedResource ? (
                  <p className="text-xs text-destructive">
                    This resource has been deleted. Remove this row or select a
                    different resource.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No {label.toLowerCase()}.
        </p>
      )}
    </fieldset>
  );
}

type FieldErrors = {
  readonly baseCapacity?: string;
  readonly name?: string;
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
  const [selectedType, setSelectedType] = useState<JobType | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [baseCapacity, setBaseCapacity] = useState("");
  const [traderCapacityPerWorker, setTraderCapacityPerWorker] = useState("");
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

    let input: CreateJobInput;

    switch (selectedType) {
      case "standard":
      case "construction":
        input = {
          baseCapacity:
            baseCapacity !== "" ? parseInt(baseCapacity, 10) : undefined,
          jobType: selectedType,
          name,
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
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "name") nameError ??= issue.message;
        else if (field === "slug") slugError ??= issue.message;
        else if (field === "baseCapacity") baseCapacityError ??= issue.message;
        else if (field === "traderCapacityPerWorker")
          traderCapacityPerWorkerError ??= issue.message;
      }
      setFieldErrors({
        baseCapacity: baseCapacityError,
        name: nameError,
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
          <legend className="mb-2 text-sm text-muted-foreground">
            Job type
          </legend>
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

            {selectedType === "deposit" ? (
              <p className="text-sm text-muted-foreground">
                Create a deposit type first to link to this job.
              </p>
            ) : null}

            {selectedType === "husbandry" || selectedType === "culling" ? (
              <p className="text-sm text-muted-foreground">
                Create a managed population type first to link to this job.
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
