import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import {
  ConfigCrudPanel,
  handleCrudError,
} from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { jobsByTypeQueryOptions, type JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { useHardDeleteRow } from "@/hooks/useHardDeleteRow";
import { useRestoreRow } from "@/hooks/useRestoreRow";
import { useSoftDeleteRow } from "@/hooks/useSoftDeleteRow";
import { depositInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { sortByName } from "@/lib/sortUtils";
import { generateLocalId } from "@/lib/uid";

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
} from "../schemas/depositSchemas";

import type {
  CreateDepositTypeInput,
  UpdateDepositTypeInput,
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
  const depositTypesQuery = useQuery(depositTypesByWorldQueryOptions(worldId));
  const depositJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "deposit"));
  const canEdit = canAdmin && !isArchived;
  const createMutation = useMutation(
    createDepositTypeMutationOptions({ queryClient }),
  );
  const depositJobs = depositJobsQuery.data ?? [];

  return (
    <ConfigCrudPanel<DepositType>
      addButtonLabel="Add deposit type"
      allData={depositTypesQuery}
      canEdit={canEdit}
      emptyTitle="No deposit types yet"
      emptyDescription="Add the first deposit type for this world."
      headerTitle="Deposit Types"
      isTrashed={(dt) => dt.isTrashed}
      renderContent={({
        canEdit: canEditProp,
        editingId,
        items,
        queryClient: qc,
        setEditingId,
        setShowForm,
        showForm,
        showTrash,
      }) => (
        <>
          {items.length > 0 ? (
            <ul aria-label="Deposit types" className="grid gap-2">
              {items.map((depositType) => {
                if (editingId === depositType.id) {
                  return (
                    <li key={depositType.id}>
                      <EditDepositTypeForm
                        allDepositTypes={items}
                        depositJobs={depositJobs}
                        depositType={depositType}
                        queryClient={qc}
                        worldId={worldId}
                        onClose={() => {
                          setEditingId(null);
                        }}
                      />
                    </li>
                  );
                }
                if (showTrash) {
                  return (
                    <li key={depositType.id}>
                      <TrashedDepositTypeRow
                        depositType={depositType}
                        queryClient={qc}
                        worldId={worldId}
                      />
                    </li>
                  );
                }
                return (
                  <li key={depositType.id}>
                    <DepositTypeRow
                      canEdit={canEditProp}
                      depositJobs={depositJobs}
                      depositType={depositType}
                      queryClient={qc}
                      worldId={worldId}
                      onEdit={() => {
                        setEditingId(depositType.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}

          {canEditProp && showForm && !showTrash ? (
            <CreateDepositTypeForm
              allDepositTypes={items}
              depositJobs={depositJobs}
              isPending={createMutation.isPending}
              worldId={worldId}
              onCancel={() => {
                setShowForm(false);
              }}
              onSubmit={(input) => {
                createMutation.mutate(input, {
                  onError: (error) => {
                    handleCrudError(error, "Failed to create deposit type.");
                  },
                  onSuccess: () => {
                    notifyMutationSuccess("Deposit type created.");
                    setShowForm(false);
                  },
                });
              }}
            />
          ) : null}
        </>
      )}
    />
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
  const softDeleteMutation = useSoftDeleteRow(
    softDeleteDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type moved to trash." },
  );

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
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
            onClick={() => {
              softDeleteMutation.mutate({
                depositTypeId: depositType.id,
                worldId,
              });
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
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
  const restoreMutation = useRestoreRow(
    restoreDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type restored." },
  );
  const hardDeleteMutation = useHardDeleteRow(
    hardDeleteDepositTypeMutationOptions({ queryClient }),
    { successMessage: "Deposit type permanently deleted." },
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
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
          onClick={() => {
            restoreMutation.mutate({ depositTypeId: depositType.id, worldId });
          }}
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
            onClick={() => {
              hardDeleteMutation.mutate({
                depositTypeId: depositType.id,
                worldId,
              });
            }}
          >
            Delete permanently
          </Button>
        )}
      </div>
    </div>
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
            <DialogDescription className="sr-only">
              Define a deposit type, worker settings, and resource outputs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
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
              <Label
                htmlFor="deposit-create-job"
                className="grid gap-1 text-sm"
              >
                <span className="text-muted-foreground">
                  Linked deposit job
                </span>
                <NativeSelect
                  id="deposit-create-job"
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
              </Label>
            )}
            <Label
              htmlFor="deposit-create-output"
              className="grid gap-1 text-sm"
            >
              <span className="text-muted-foreground">
                Output units per worker
              </span>
              <Input
                id="deposit-create-output"
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
      id: generateLocalId(),
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
