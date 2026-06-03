import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { SlugHint } from "@/components/shared/SlugHint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { jobsByTypeQueryOptions, type JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { depositInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { sortByName } from "@/lib/sortUtils";

import {
  createDepositTypeMutationOptions,
  hardDeleteDepositTypeMutationOptions,
  restoreDepositTypeMutationOptions,
  softDeleteDepositTypeMutationOptions,
  updateDepositTypeMutationOptions,
} from "../mutations/depositsMutations";
import { depositTypesByWorldQueryOptions } from "../queries/depositsQueries";
import {
  createDepositTypeInputSchema,
  updateDepositTypeInputSchema,
  type CreateDepositTypeInput,
  type UpdateDepositTypeInput,
} from "../schemas/depositSchemas";

import type { DepositType } from "../types/depositTypes";

type DepositsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function DepositsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: DepositsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const depositTypesQuery = useQuery(depositTypesByWorldQueryOptions(worldId));

  if (depositTypesQuery.isPending) {
    return <LoadingState label="Loading deposit types…" />;
  }

  if (depositTypesQuery.isError) {
    return (
      <ErrorState
        title="Deposit types could not be loaded"
        description={getErrorDescription(depositTypesQuery.error)}
      />
    );
  }

  const allDepositTypes = depositTypesQuery.data;
  const visibleDepositTypes = showTrash
    ? allDepositTypes.filter((dt) => dt.isTrashed)
    : allDepositTypes.filter((dt) => !dt.isTrashed);

  return (
    <DepositsConfigPanelContent
      allDepositTypes={allDepositTypes}
      canAdmin={canAdmin}
      depositTypes={visibleDepositTypes}
      isArchived={isArchived}
      queryClient={queryClient}
      showTrash={showTrash}
      worldId={worldId}
      onToggleTrash={() => {
        setShowTrash((v) => !v);
      }}
    />
  );
}

function DepositsConfigPanelContent({
  allDepositTypes,
  canAdmin,
  depositTypes,
  isArchived,
  queryClient,
  showTrash,
  worldId,
  onToggleTrash,
}: {
  readonly allDepositTypes: readonly DepositType[];
  readonly canAdmin: boolean;
  readonly depositTypes: readonly DepositType[];
  readonly isArchived: boolean;
  readonly onToggleTrash: () => void;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  const createMutation = useMutation(
    createDepositTypeMutationOptions({ queryClient }),
  );
  const depositJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "deposit"));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDepositTypeId, setEditingDepositTypeId] = useState<
    string | null
  >(null);
  const canEdit = canAdmin && !isArchived;

  const depositJobs = depositJobsQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2
          id="world-deposits-title"
          className="text-lg font-semibold tracking-normal"
        >
          Deposit Types
        </h2>
        <div className="flex items-center gap-2">
          {canEdit && !showCreateForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateForm(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add deposit type
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

      {depositTypes.length > 0 ? (
        <DepositTypeList
          allDepositTypes={allDepositTypes}
          canEdit={canEdit}
          depositJobs={depositJobs}
          depositTypes={depositTypes}
          editingDepositTypeId={editingDepositTypeId}
          queryClient={queryClient}
          showTrash={showTrash}
          worldId={worldId}
          onEditingChange={setEditingDepositTypeId}
        />
      ) : showTrash ? (
        <EmptyState title="No deposit types in trash" />
      ) : (
        <EmptyState
          title="No deposit types yet"
          description="Add the first deposit type for this world."
        />
      )}

      {canEdit && showCreateForm && !showTrash ? (
        <CreateDepositTypeForm
          allDepositTypes={allDepositTypes}
          depositJobs={depositJobs}
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowCreateForm(false);
          }}
          onSubmit={(input) => {
            createMutation.mutate(input, {
              onError: (error) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to create deposit type.",
                );
              },
              onSuccess: () => {
                notifyMutationSuccess("Deposit type created.");
                setShowCreateForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}

function DepositTypeList({
  allDepositTypes,
  canEdit,
  depositJobs,
  depositTypes,
  editingDepositTypeId,
  queryClient,
  showTrash,
  worldId,
  onEditingChange,
}: {
  readonly allDepositTypes: readonly DepositType[];
  readonly canEdit: boolean;
  readonly depositJobs: readonly JobDefinition[];
  readonly depositTypes: readonly DepositType[];
  readonly editingDepositTypeId: string | null;
  readonly onEditingChange: (id: string | null) => void;
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  return (
    <ul aria-label="Deposit types" className="grid gap-2">
      {depositTypes.map((depositType) => {
        if (showTrash) {
          return (
            <TrashedDepositTypeRow
              key={depositType.id}
              depositType={depositType}
              queryClient={queryClient}
              worldId={worldId}
            />
          );
        }
        return editingDepositTypeId === depositType.id ? (
          <li key={depositType.id}>
            <EditDepositTypeForm
              allDepositTypes={allDepositTypes}
              depositJobs={depositJobs}
              depositType={depositType}
              queryClient={queryClient}
              worldId={worldId}
              onClose={() => {
                onEditingChange(null);
              }}
            />
          </li>
        ) : (
          <DepositTypeRow
            key={depositType.id}
            canEdit={canEdit}
            depositJobs={depositJobs}
            depositType={depositType}
            queryClient={queryClient}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(depositType.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function DepositTypeRow({
  depositType,
  canEdit,
  depositJobs,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly depositType: DepositType;
  readonly canEdit: boolean;
  readonly depositJobs: readonly JobDefinition[];
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const linkedJob = depositJobs.find((j) => j.id === depositType.jobId);
  const softDeleteMutation = useMutation(
    softDeleteDepositTypeMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { depositTypeId: depositType.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to move deposit type to trash.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Deposit type moved to trash.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{depositType.name}</span>
        <span className="text-xs text-muted-foreground">
          {depositType.outputUnitsPerWorker.toLocaleString()} output/worker
          {linkedJob !== undefined ? ` · ${linkedJob.name}` : null}
        </span>
      </div>
      <div className="flex items-center gap-3">
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
            aria-label={`Move ${depositType.name} to trash`}
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

function TrashedDepositTypeRow({
  depositType,
  queryClient,
  worldId,
}: {
  readonly depositType: DepositType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreDepositTypeMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteDepositTypeMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { depositTypeId: depositType.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to restore deposit type.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Deposit type restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { depositTypeId: depositType.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to permanently delete deposit type.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Deposit type permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{depositType.name}</span>
          <Badge variant="outline">trashed</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {depositType.outputUnitsPerWorker.toLocaleString()} output/worker
        </span>
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
        {depositType.hasActiveReferences ? (
          <span title="Cannot permanently delete: this deposit type is referenced by active job configurations.">
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

type DepositTypeFieldErrors = {
  readonly jobId?: string;
  readonly name?: string;
  readonly outputUnitsPerWorker?: string;
  readonly slug?: string;
};

function CreateDepositTypeForm({
  allDepositTypes,
  depositJobs,
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly allDepositTypes: readonly DepositType[];
  readonly depositJobs: readonly JobDefinition[];
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateDepositTypeInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const [name, setName] = useState("");
  const [jobId, setJobId] = useState("");
  const [outputUnitsPerWorker, setOutputUnitsPerWorker] = useState("1");
  const [workerInputs, setWorkerInputs] = useState<ResourceAmountEntry[]>([]);
  const [fieldErrors, setFieldErrors] = useState<DepositTypeFieldErrors>({});
  const [jobLinkError, setJobLinkError] = useState<string | undefined>(
    undefined,
  );

  const derivedSlug = toSlug(name, {
    maxLength: depositInputLimits.depositTypeSlugMax,
  });

  function handleJobChange(selectedJobId: string): void {
    setJobId(selectedJobId);
    const conflict = allDepositTypes.find(
      (dt) => dt.jobId === selectedJobId && selectedJobId !== "",
    );
    setJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldErrors({});

    if (jobLinkError !== undefined) return;

    const input: CreateDepositTypeInput = {
      jobId,
      name,
      outputUnitsPerWorker:
        outputUnitsPerWorker !== "" ? parseInt(outputUnitsPerWorker, 10) : 0,
      slug: derivedSlug,
      workerInputsJson:
        workerInputs.length > 0
          ? workerInputs.map((e) => ({
              amountPerWorker: parseFloat(e.amount),
              resourceId: e.resourceId,
            }))
          : undefined,
      worldId,
    };

    const result = createDepositTypeInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        jobId: errors.jobId,
        name: errors.name,
        outputUnitsPerWorker: errors.outputUnitsPerWorker,
        slug: errors.slug,
      });
      return;
    }

    onSubmit(input);
  }

  const resources = resourcesQuery.data ?? [];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create deposit type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
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
            </label>
            {depositJobs.length === 0 ? (
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  Linked deposit job
                </span>
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
              <label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  Linked deposit job
                </span>
                <NativeSelect
                  aria-invalid={
                    fieldErrors.jobId !== undefined ||
                    jobLinkError !== undefined
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
                  <p className="text-xs text-destructive">
                    {fieldErrors.jobId}
                  </p>
                ) : null}
              </label>
            )}
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Output units per worker
              </span>
              <Input
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
            </label>
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
              disabled={isPending || jobLinkError !== undefined}
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

function EditDepositTypeForm({
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
  const [jobId, setJobId] = useState(depositType.jobId);

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(
      toSlug(value, { maxLength: depositInputLimits.depositTypeSlugMax }),
    );
  }
  const [outputUnitsPerWorker, setOutputUnitsPerWorker] = useState(
    String(depositType.outputUnitsPerWorker),
  );
  const [workerInputs, setWorkerInputs] = useState<ResourceAmountEntry[]>(
    depositType.workerInputsJson.map((e) => ({
      amount: String(e.amountPerWorker),
      resourceId: e.resourceId,
    })),
  );
  const [fieldErrors, setFieldErrors] = useState<DepositTypeFieldErrors>({});
  const [jobLinkError, setJobLinkError] = useState<string | undefined>(
    undefined,
  );

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

  function handleJobChange(selectedJobId: string): void {
    setJobId(selectedJobId);
    const conflict = allDepositTypes.find(
      (dt) =>
        dt.jobId === selectedJobId &&
        selectedJobId !== "" &&
        dt.id !== depositType.id,
    );
    setJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFieldErrors({});

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
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        jobId: errors.jobId,
        name: errors.name,
        outputUnitsPerWorker: errors.outputUnitsPerWorker,
        slug: errors.slug,
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Deposit type saved.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save deposit type.",
      );
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
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to move deposit type to trash.",
      );
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
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
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
        </label>
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
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Linked deposit job</span>
            <NativeSelect
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
          </label>
        )}
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Output units per worker</span>
          <Input
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
        </label>
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
