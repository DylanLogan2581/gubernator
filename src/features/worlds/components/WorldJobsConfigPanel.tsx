import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createJobInputSchema,
  createJobMutationOptions,
  jobsByWorldQueryOptions,
  type CreateJobInput,
  type JobDefinition,
  type JobType,
} from "@/features/jobs";
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
        <JobList jobs={filteredJobs} showArchived={showArchived} />
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
  jobs,
  showArchived,
}: {
  readonly jobs: readonly JobDefinition[];
  readonly showArchived: boolean;
}): JSX.Element {
  return (
    <ul aria-label="Jobs" className="grid gap-2">
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} showArchived={showArchived} />
      ))}
    </ul>
  );
}

function JobRow({
  job,
  showArchived,
}: {
  readonly job: JobDefinition;
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
      <JobCapacityDisplay job={job} />
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
