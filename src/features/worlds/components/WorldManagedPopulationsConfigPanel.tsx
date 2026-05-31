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
import { PercentInput } from "@/components/shared/PercentInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { jobsByTypeQueryOptions, type JobDefinition } from "@/features/jobs";
import {
  createManagedPopulationTypeInputSchema,
  createManagedPopulationTypeMutationOptions,
  hardDeleteManagedPopulationTypeMutationOptions,
  managedPopulationTypesByWorldQueryOptions,
  restoreManagedPopulationTypeMutationOptions,
  softDeleteManagedPopulationTypeMutationOptions,
  updateManagedPopulationTypeInputSchema,
  updateManagedPopulationTypeMutationOptions,
  type CreateManagedPopulationTypeInput,
  type ManagedPopulationType,
  type PopulationResourceEntry,
  type UpdateManagedPopulationTypeInput,
} from "@/features/managed-populations";
import {
  activeResourcesByWorldQueryOptions,
  type Resource,
} from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { managedPopulationInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";

type WorldManagedPopulationsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldManagedPopulationsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: WorldManagedPopulationsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const populationTypesQuery = useQuery(
    managedPopulationTypesByWorldQueryOptions(worldId),
  );

  if (populationTypesQuery.isPending) {
    return (
      <section
        aria-labelledby="world-managed-populations-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading managed population types…" />
      </section>
    );
  }

  if (populationTypesQuery.isError) {
    return (
      <section
        aria-labelledby="world-managed-populations-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Managed population types could not be loaded"
          description={getErrorDescription(populationTypesQuery.error)}
        />
      </section>
    );
  }

  const allPopulationTypes = populationTypesQuery.data;
  const visiblePopulationTypes = showTrash
    ? allPopulationTypes.filter((pt) => pt.isTrashed)
    : allPopulationTypes.filter((pt) => !pt.isTrashed);

  return (
    <WorldManagedPopulationsConfigPanelContent
      allPopulationTypes={allPopulationTypes}
      canAdmin={canAdmin}
      isArchived={isArchived}
      populationTypes={visiblePopulationTypes}
      queryClient={queryClient}
      showTrash={showTrash}
      worldId={worldId}
      onToggleTrash={() => {
        setShowTrash((v) => !v);
      }}
    />
  );
}

function WorldManagedPopulationsConfigPanelContent({
  allPopulationTypes,
  canAdmin,
  isArchived,
  populationTypes,
  queryClient,
  showTrash,
  worldId,
  onToggleTrash,
}: {
  readonly allPopulationTypes: readonly ManagedPopulationType[];
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly onToggleTrash: () => void;
  readonly populationTypes: readonly ManagedPopulationType[];
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  const createMutation = useMutation(
    createManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const husbandryJobsQuery = useQuery(
    jobsByTypeQueryOptions(worldId, "husbandry"),
  );
  const cullingJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "culling"));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPopulationTypeId, setEditingPopulationTypeId] = useState<
    string | null
  >(null);
  const canEdit = canAdmin && !isArchived;

  const husbandryJobs = husbandryJobsQuery.data ?? [];
  const cullingJobs = cullingJobsQuery.data ?? [];

  return (
    <section
      aria-labelledby="world-managed-populations-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-center justify-between">
        <h2
          id="world-managed-populations-title"
          className="text-lg font-semibold tracking-normal"
        >
          Managed Population Types
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
              Add population type
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

      {populationTypes.length > 0 ? (
        <ManagedPopulationTypeList
          allPopulationTypes={allPopulationTypes}
          canEdit={canEdit}
          cullingJobs={cullingJobs}
          editingPopulationTypeId={editingPopulationTypeId}
          husbandryJobs={husbandryJobs}
          populationTypes={populationTypes}
          queryClient={queryClient}
          showTrash={showTrash}
          worldId={worldId}
          onEditingChange={setEditingPopulationTypeId}
        />
      ) : showTrash ? (
        <EmptyState title="No managed population types in trash" />
      ) : !showCreateForm ? (
        <EmptyState
          title="No managed population types yet"
          description="Add the first managed population type for this world."
        />
      ) : null}

      {canEdit && showCreateForm && !showTrash ? (
        <CreateManagedPopulationTypeForm
          allPopulationTypes={allPopulationTypes}
          cullingJobs={cullingJobs}
          husbandryJobs={husbandryJobs}
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
                    : "Failed to create managed population type.",
                );
              },
              onSuccess: () => {
                notifyMutationSuccess("Managed population type created.");
                setShowCreateForm(false);
              },
            });
          }}
        />
      ) : null}
    </section>
  );
}

function ManagedPopulationTypeList({
  allPopulationTypes,
  canEdit,
  cullingJobs,
  editingPopulationTypeId,
  husbandryJobs,
  populationTypes,
  queryClient,
  showTrash,
  worldId,
  onEditingChange,
}: {
  readonly allPopulationTypes: readonly ManagedPopulationType[];
  readonly canEdit: boolean;
  readonly cullingJobs: readonly JobDefinition[];
  readonly editingPopulationTypeId: string | null;
  readonly husbandryJobs: readonly JobDefinition[];
  readonly onEditingChange: (id: string | null) => void;
  readonly populationTypes: readonly ManagedPopulationType[];
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  return (
    <ul aria-label="Managed population types" className="grid gap-2">
      {populationTypes.map((populationType) => {
        if (showTrash) {
          return (
            <TrashedManagedPopulationTypeRow
              key={populationType.id}
              populationType={populationType}
              queryClient={queryClient}
              worldId={worldId}
            />
          );
        }
        return editingPopulationTypeId === populationType.id ? (
          <li key={populationType.id}>
            <EditManagedPopulationTypeForm
              allPopulationTypes={allPopulationTypes}
              cullingJobs={cullingJobs}
              husbandryJobs={husbandryJobs}
              populationType={populationType}
              queryClient={queryClient}
              worldId={worldId}
              onClose={() => {
                onEditingChange(null);
              }}
            />
          </li>
        ) : (
          <ManagedPopulationTypeRow
            key={populationType.id}
            canEdit={canEdit}
            cullingJobs={cullingJobs}
            husbandryJobs={husbandryJobs}
            populationType={populationType}
            queryClient={queryClient}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(populationType.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function ManagedPopulationTypeRow({
  populationType,
  canEdit,
  cullingJobs,
  husbandryJobs,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly onEdit: () => void;
  readonly populationType: ManagedPopulationType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const husbandryJob = husbandryJobs.find(
    (j) => j.id === populationType.husbandryJobId,
  );
  const cullingJob = cullingJobs.find(
    (j) => j.id === populationType.cullingJobId,
  );
  const softDeleteMutation = useMutation(
    softDeleteManagedPopulationTypeMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { managedPopulationTypeId: populationType.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to move managed population type to trash.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Managed population type moved to trash.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{populationType.name}</span>
        <span className="text-xs text-muted-foreground">
          {(populationType.growthRate * 100).toFixed(1)}% growth ·{" "}
          {populationType.husbandryWorkersPerNAnimals.toLocaleString()}{" "}
          workers/N
          {husbandryJob !== undefined ? ` · ${husbandryJob.name}` : null}
          {cullingJob !== undefined ? ` · ${cullingJob.name}` : null}
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
            aria-label={`Move ${populationType.name} to trash`}
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

function TrashedManagedPopulationTypeRow({
  populationType,
  queryClient,
  worldId,
}: {
  readonly populationType: ManagedPopulationType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { managedPopulationTypeId: populationType.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to restore managed population type.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Managed population type restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { managedPopulationTypeId: populationType.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to permanently delete managed population type.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Managed population type permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{populationType.name}</span>
          <Badge variant="outline">trashed</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {(populationType.growthRate * 100).toFixed(1)}% growth
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
        {populationType.hasActiveReferences ? (
          <span title="Cannot permanently delete: this population type is referenced by active job configurations.">
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

type ManagedPopulationTypeFieldErrors = {
  readonly cullingJobId?: string;
  readonly growthRate?: string;
  readonly husbandryJobId?: string;
  readonly husbandryWorkersPerNAnimals?: string;
  readonly name?: string;
  readonly slug?: string;
};

function PopulationTypeScalarFields({
  cullingJobId,
  cullingJobLinkError,
  cullingJobs,
  fieldErrors,
  growthRate,
  husbandryJobId,
  husbandryJobLinkError,
  husbandryJobs,
  husbandryWorkersPerNAnimals,
  isPending,
  jobCollisionError,
  name,
  slug,
  worldId,
  onCullingJobChange,
  onGrowthRateChange,
  onHusbandryJobChange,
  onHusbandryWorkersPerNAnimalsChange,
  onNameChange,
  onSlugChange,
}: {
  readonly cullingJobId: string;
  readonly cullingJobLinkError: string | undefined;
  readonly cullingJobs: readonly JobDefinition[];
  readonly fieldErrors: ManagedPopulationTypeFieldErrors;
  readonly growthRate: number;
  readonly husbandryJobId: string;
  readonly husbandryJobLinkError: string | undefined;
  readonly husbandryJobs: readonly JobDefinition[];
  readonly husbandryWorkersPerNAnimals: string;
  readonly isPending: boolean;
  readonly jobCollisionError: string | undefined;
  readonly name: string;
  readonly slug: string;
  readonly worldId: string;
  readonly onCullingJobChange: (value: string) => void;
  readonly onGrowthRateChange: (value: number) => void;
  readonly onHusbandryJobChange: (value: string) => void;
  readonly onHusbandryWorkersPerNAnimalsChange: (value: string) => void;
  readonly onNameChange: (value: string) => void;
  readonly onSlugChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={fieldErrors.name !== undefined}
          disabled={isPending}
          maxLength={managedPopulationInputLimits.populationTypeNameMax}
          value={name}
          onChange={(e) => {
            onNameChange(e.currentTarget.value);
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
          maxLength={managedPopulationInputLimits.populationTypeSlugMax}
          value={slug}
          onChange={(e) => {
            onSlugChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.slug !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.slug}</p>
        ) : null}
      </label>
      {husbandryJobs.length === 0 ? (
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Husbandry job</span>
          <EmptyState
            title="No husbandry jobs yet"
            description="Create one to assign to this population type."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/worlds/$worldId/configuration"
                  params={{ worldId }}
                  search={{ tab: "jobs" }}
                >
                  Create husbandry job
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Husbandry job</span>
          <NativeSelect
            aria-invalid={
              fieldErrors.husbandryJobId !== undefined ||
              husbandryJobLinkError !== undefined ||
              jobCollisionError !== undefined
            }
            className="w-full"
            disabled={isPending}
            value={husbandryJobId}
            onChange={(e) => {
              onHusbandryJobChange(e.currentTarget.value);
            }}
          >
            <option value="">Select a husbandry job…</option>
            {sortByName(husbandryJobs).map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </NativeSelect>
          {husbandryJobLinkError !== undefined ? (
            <p className="text-xs text-destructive">{husbandryJobLinkError}</p>
          ) : jobCollisionError !== undefined ? (
            <p className="text-xs text-destructive">{jobCollisionError}</p>
          ) : fieldErrors.husbandryJobId !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.husbandryJobId}
            </p>
          ) : null}
        </label>
      )}
      {cullingJobs.length === 0 ? (
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Culling job</span>
          <EmptyState
            title="No culling jobs yet"
            description="Create one to assign to this population type."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/worlds/$worldId/configuration"
                  params={{ worldId }}
                  search={{ tab: "jobs" }}
                >
                  Create culling job
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Culling job</span>
          <NativeSelect
            aria-invalid={
              fieldErrors.cullingJobId !== undefined ||
              cullingJobLinkError !== undefined ||
              jobCollisionError !== undefined
            }
            className="w-full"
            disabled={isPending}
            value={cullingJobId}
            onChange={(e) => {
              onCullingJobChange(e.currentTarget.value);
            }}
          >
            <option value="">Select a culling job…</option>
            {sortByName(cullingJobs).map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </NativeSelect>
          {cullingJobLinkError !== undefined ? (
            <p className="text-xs text-destructive">{cullingJobLinkError}</p>
          ) : jobCollisionError !== undefined ? (
            <p className="text-xs text-destructive">{jobCollisionError}</p>
          ) : fieldErrors.cullingJobId !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.cullingJobId}
            </p>
          ) : null}
        </label>
      )}
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">
          Husbandry workers per N animals
        </span>
        <Input
          aria-invalid={fieldErrors.husbandryWorkersPerNAnimals !== undefined}
          disabled={isPending}
          inputMode="numeric"
          placeholder="1"
          value={husbandryWorkersPerNAnimals}
          onChange={(e) => {
            onHusbandryWorkersPerNAnimalsChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.husbandryWorkersPerNAnimals !== undefined ? (
          <p className="text-xs text-destructive">
            {fieldErrors.husbandryWorkersPerNAnimals}
          </p>
        ) : null}
      </label>
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Growth rate</span>
        <PercentInput
          aria-invalid={fieldErrors.growthRate !== undefined}
          aria-label="Growth rate"
          disabled={isPending}
          value={growthRate}
          onChange={onGrowthRateChange}
        />
        {fieldErrors.growthRate !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.growthRate}</p>
        ) : null}
      </div>
    </div>
  );
}

function CreateManagedPopulationTypeForm({
  allPopulationTypes,
  cullingJobs,
  husbandryJobs,
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly allPopulationTypes: readonly ManagedPopulationType[];
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateManagedPopulationTypeInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [husbandryJobId, setHusbandryJobId] = useState("");
  const [cullingJobId, setCullingJobId] = useState("");
  const [husbandryWorkersPerNAnimals, setHusbandryWorkersPerNAnimals] =
    useState("1");
  const [growthRate, setGrowthRate] = useState(0);
  const [maintenanceRules, setMaintenanceRules] = useState<
    PopulationResourceEntry[]
  >([]);
  const [cullingOutputs, setCullingOutputs] = useState<
    PopulationResourceEntry[]
  >([]);
  const [fieldErrors, setFieldErrors] =
    useState<ManagedPopulationTypeFieldErrors>({});
  const [husbandryJobLinkError, setHusbandryJobLinkError] = useState<
    string | undefined
  >(undefined);
  const [cullingJobLinkError, setCullingJobLinkError] = useState<
    string | undefined
  >(undefined);

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

  function handleHusbandryJobChange(selectedId: string): void {
    setHusbandryJobId(selectedId);
    const conflict = allPopulationTypes.find(
      (pt) => pt.husbandryJobId === selectedId && selectedId !== "",
    );
    setHusbandryJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  function handleCullingJobChange(selectedId: string): void {
    setCullingJobId(selectedId);
    const conflict = allPopulationTypes.find(
      (pt) => pt.cullingJobId === selectedId && selectedId !== "",
    );
    setCullingJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  const jobCollisionError =
    husbandryJobId !== "" &&
    cullingJobId !== "" &&
    husbandryJobId === cullingJobId
      ? "Husbandry job and culling job must be different."
      : undefined;

  const hasJobError =
    husbandryJobLinkError !== undefined ||
    cullingJobLinkError !== undefined ||
    jobCollisionError !== undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldErrors({});

    if (hasJobError) return;

    const input: CreateManagedPopulationTypeInput = {
      cullingJobId,
      cullingOutputsJson:
        cullingOutputs.length > 0 ? cullingOutputs : undefined,
      growthRate,
      husbandryJobId,
      husbandryWorkersPerNAnimals:
        husbandryWorkersPerNAnimals !== ""
          ? parseInt(husbandryWorkersPerNAnimals, 10)
          : 0,
      maintenanceRulesJson:
        maintenanceRules.length > 0 ? maintenanceRules : undefined,
      name,
      slug,
      worldId,
    };

    const result = createManagedPopulationTypeInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        cullingJobId: errors.cullingJobId,
        growthRate: errors.growthRate,
        husbandryJobId: errors.husbandryJobId,
        husbandryWorkersPerNAnimals: errors.husbandryWorkersPerNAnimals,
        name: errors.name,
        slug: errors.slug,
      });
      return;
    }

    onSubmit(input);
  }

  const resources = resourcesQuery.data ?? [];

  return (
    <form
      aria-label="Create managed population type"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <h3 className="text-sm font-medium">New managed population type</h3>
      <div className="grid gap-3">
        <PopulationTypeScalarFields
          cullingJobId={cullingJobId}
          cullingJobLinkError={cullingJobLinkError}
          cullingJobs={cullingJobs}
          fieldErrors={fieldErrors}
          growthRate={growthRate}
          husbandryJobId={husbandryJobId}
          husbandryJobLinkError={husbandryJobLinkError}
          husbandryJobs={husbandryJobs}
          husbandryWorkersPerNAnimals={husbandryWorkersPerNAnimals}
          isPending={isPending}
          jobCollisionError={jobCollisionError}
          name={name}
          slug={slug}
          worldId={worldId}
          onCullingJobChange={handleCullingJobChange}
          onGrowthRateChange={setGrowthRate}
          onHusbandryJobChange={handleHusbandryJobChange}
          onHusbandryWorkersPerNAnimalsChange={setHusbandryWorkersPerNAnimals}
          onNameChange={handleNameChange}
          onSlugChange={handleSlugChange}
        />
        <PopulationResourceEditor
          disabled={isPending}
          entries={maintenanceRules}
          label="Maintenance rules"
          resources={resources}
          onChange={setMaintenanceRules}
        />
        <PopulationResourceEditor
          disabled={isPending}
          entries={cullingOutputs}
          label="Culling outputs"
          resources={resources}
          onChange={setCullingOutputs}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || hasJobError}>
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

function EditManagedPopulationTypeForm({
  allPopulationTypes,
  cullingJobs,
  husbandryJobs,
  populationType,
  onClose,
  queryClient,
  worldId,
}: {
  readonly allPopulationTypes: readonly ManagedPopulationType[];
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly onClose: () => void;
  readonly populationType: ManagedPopulationType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(
    updateManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const softDeleteMutation = useMutation(
    softDeleteManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const [name, setName] = useState(populationType.name);
  const [slug, setSlug] = useState(populationType.slug);
  const [husbandryJobId, setHusbandryJobId] = useState(
    populationType.husbandryJobId,
  );
  const [cullingJobId, setCullingJobId] = useState(populationType.cullingJobId);
  const [husbandryWorkersPerNAnimals, setHusbandryWorkersPerNAnimals] =
    useState(String(populationType.husbandryWorkersPerNAnimals));
  const [growthRate, setGrowthRate] = useState(populationType.growthRate);
  const [maintenanceRules, setMaintenanceRules] = useState<
    PopulationResourceEntry[]
  >([...populationType.maintenanceRulesJson]);
  const [cullingOutputs, setCullingOutputs] = useState<
    PopulationResourceEntry[]
  >([...populationType.cullingOutputsJson]);
  const [fieldErrors, setFieldErrors] =
    useState<ManagedPopulationTypeFieldErrors>({});
  const [husbandryJobLinkError, setHusbandryJobLinkError] = useState<
    string | undefined
  >(undefined);
  const [cullingJobLinkError, setCullingJobLinkError] = useState<
    string | undefined
  >(undefined);

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

  function handleHusbandryJobChange(selectedId: string): void {
    setHusbandryJobId(selectedId);
    const conflict = allPopulationTypes.find(
      (pt) =>
        pt.husbandryJobId === selectedId &&
        selectedId !== "" &&
        pt.id !== populationType.id,
    );
    setHusbandryJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  function handleCullingJobChange(selectedId: string): void {
    setCullingJobId(selectedId);
    const conflict = allPopulationTypes.find(
      (pt) =>
        pt.cullingJobId === selectedId &&
        selectedId !== "" &&
        pt.id !== populationType.id,
    );
    setCullingJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  const jobCollisionError =
    husbandryJobId !== "" &&
    cullingJobId !== "" &&
    husbandryJobId === cullingJobId
      ? "Husbandry job and culling job must be different."
      : undefined;

  const hasJobError =
    husbandryJobLinkError !== undefined ||
    cullingJobLinkError !== undefined ||
    jobCollisionError !== undefined;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFieldErrors({});

    if (hasJobError) return;

    const updateInput: UpdateManagedPopulationTypeInput = {
      cullingJobId,
      cullingOutputsJson: cullingOutputs,
      growthRate,
      husbandryJobId,
      husbandryWorkersPerNAnimals:
        husbandryWorkersPerNAnimals !== ""
          ? parseInt(husbandryWorkersPerNAnimals, 10)
          : undefined,
      maintenanceRulesJson: maintenanceRules,
      managedPopulationTypeId: populationType.id,
      name,
      slug,
      worldId,
    };

    const result =
      updateManagedPopulationTypeInputSchema.safeParse(updateInput);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        cullingJobId: errors.cullingJobId,
        growthRate: errors.growthRate,
        husbandryJobId: errors.husbandryJobId,
        husbandryWorkersPerNAnimals: errors.husbandryWorkersPerNAnimals,
        name: errors.name,
        slug: errors.slug,
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Managed population type saved.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save managed population type.",
      );
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      await softDeleteMutation.mutateAsync({
        managedPopulationTypeId: populationType.id,
        worldId,
      });
      notifyMutationSuccess("Managed population type moved to trash.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to move managed population type to trash.",
      );
    }
  }

  const resources = resourcesQuery.data ?? [];

  return (
    <form
      aria-label="Edit managed population type"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit managed population type</h3>
      <div className="grid gap-3">
        <PopulationTypeScalarFields
          cullingJobId={cullingJobId}
          cullingJobLinkError={cullingJobLinkError}
          cullingJobs={cullingJobs}
          fieldErrors={fieldErrors}
          growthRate={growthRate}
          husbandryJobId={husbandryJobId}
          husbandryJobLinkError={husbandryJobLinkError}
          husbandryJobs={husbandryJobs}
          husbandryWorkersPerNAnimals={husbandryWorkersPerNAnimals}
          isPending={isPending}
          jobCollisionError={jobCollisionError}
          name={name}
          slug={slug}
          worldId={worldId}
          onCullingJobChange={handleCullingJobChange}
          onGrowthRateChange={setGrowthRate}
          onHusbandryJobChange={handleHusbandryJobChange}
          onHusbandryWorkersPerNAnimalsChange={setHusbandryWorkersPerNAnimals}
          onNameChange={setName}
          onSlugChange={setSlug}
        />
        <PopulationResourceEditor
          disabled={isPending}
          entries={maintenanceRules}
          label="Maintenance rules"
          resources={resources}
          onChange={setMaintenanceRules}
        />
        <PopulationResourceEditor
          disabled={isPending}
          entries={cullingOutputs}
          label="Culling outputs"
          resources={resources}
          onChange={setCullingOutputs}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending || hasJobError}>
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

function PopulationResourceEditor({
  disabled,
  entries,
  label,
  resources,
  onChange,
}: {
  readonly disabled: boolean;
  readonly entries: PopulationResourceEntry[];
  readonly label: string;
  readonly resources: readonly Resource[];
  readonly onChange: (entries: PopulationResourceEntry[]) => void;
}): JSX.Element {
  const availableResources = resources.filter((r) => !r.isTrashed);

  function handleAdd(): void {
    if (availableResources.length === 0) return;
    const usedIds = new Set(entries.map((e) => e.resourceId));
    const firstUnused = availableResources.find((r) => !usedIds.has(r.id));
    if (firstUnused === undefined) return;
    onChange([
      ...entries,
      { amountPerNAnimals: 1, resourceId: firstUnused.id },
    ]);
  }

  function handleRemove(index: number): void {
    onChange(entries.filter((_, i) => i !== index));
  }

  function handleResourceChange(index: number, resourceId: string): void {
    onChange(entries.map((e, i) => (i === index ? { ...e, resourceId } : e)));
  }

  function handleAmountChange(index: number, value: string): void {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(
        entries.map((e, i) =>
          i === index ? { ...e, amountPerNAnimals: parsed } : e,
        ),
      );
    }
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
            availableResources.length === 0 ||
            entries.length >= availableResources.length
          }
          onClick={handleAdd}
        >
          <Plus aria-hidden="true" />
          Add entry
        </Button>
      </div>
      {entries.length > 0 ? (
        <ul className="grid gap-2">
          {entries.map((entry, index) => (
            <li key={index} className="flex items-center gap-2">
              <NativeSelect
                aria-label={`${label} entry ${String(index + 1)} resource`}
                className="flex-1"
                disabled={disabled}
                value={entry.resourceId}
                onChange={(e) => {
                  handleResourceChange(index, e.currentTarget.value);
                }}
              >
                {sortByName(availableResources).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
              <Input
                aria-label={`${label} entry ${String(index + 1)} amount per N animals`}
                className="w-24 shrink-0"
                disabled={disabled}
                inputMode="decimal"
                placeholder="1"
                value={String(entry.amountPerNAnimals)}
                onChange={(e) => {
                  handleAmountChange(index, e.currentTarget.value);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Remove ${label} entry ${String(index + 1)}`}
                disabled={disabled}
                onClick={() => {
                  handleRemove(index);
                }}
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No entries.</p>
      )}
    </fieldset>
  );
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, managedPopulationInputLimits.populationTypeSlugMax);
}
