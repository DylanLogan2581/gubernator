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
import { NativeSelect } from "@/components/ui/native-select";
import { jobsByTypeQueryOptions, type JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { managedPopulationInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";
import { sortByName } from "@/lib/sortUtils";
import { generateLocalId } from "@/lib/uid";

import {
  createManagedPopulationTypeMutationOptions,
  hardDeleteManagedPopulationTypeMutationOptions,
  restoreManagedPopulationTypeMutationOptions,
  softDeleteManagedPopulationTypeMutationOptions,
  updateManagedPopulationTypeMutationOptions,
} from "../mutations/managedPopulationsMutations";
import { managedPopulationTypesByWorldQueryOptions } from "../queries/managedPopulationsQueries";
import {
  createManagedPopulationTypeInputSchema,
  updateManagedPopulationTypeInputSchema,
  type CreateManagedPopulationTypeInput,
  type UpdateManagedPopulationTypeInput,
} from "../schemas/managedPopulationSchemas";

import type { ManagedPopulationType } from "../types/managedPopulationTypes";

type ManagedPopulationsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ManagedPopulationsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ManagedPopulationsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const populationTypesQuery = useQuery(
    managedPopulationTypesByWorldQueryOptions(worldId),
  );

  if (populationTypesQuery.isPending) {
    return <LoadingState label="Loading managed population types…" />;
  }

  if (populationTypesQuery.isError) {
    return (
      <ErrorState
        title="Managed population types could not be loaded"
        description={getErrorDescription(populationTypesQuery.error)}
      />
    );
  }

  const allPopulationTypes = populationTypesQuery.data;
  const visiblePopulationTypes = showTrash
    ? allPopulationTypes.filter((pt) => pt.isTrashed)
    : allPopulationTypes.filter((pt) => !pt.isTrashed);

  return (
    <ManagedPopulationsConfigPanelContent
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

function ManagedPopulationsConfigPanelContent({
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
    <div className="grid gap-4">
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
      ) : (
        <EmptyState
          title="No managed population types yet"
          description="Add the first managed population type for this world."
        />
      )}

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
    </div>
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
}): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={fieldErrors.name !== undefined}
          aria-label="Name"
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
        <SlugHint slug={slug} error={fieldErrors.slug} />
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
  const [husbandryJobId, setHusbandryJobId] = useState("");
  const [cullingJobId, setCullingJobId] = useState("");
  const [husbandryWorkersPerNAnimals, setHusbandryWorkersPerNAnimals] =
    useState("1");
  const [growthRate, setGrowthRate] = useState(0);
  const [maintenanceRules, setMaintenanceRules] = useState<
    ResourceAmountEntry[]
  >([]);
  const [cullingOutputs, setCullingOutputs] = useState<ResourceAmountEntry[]>(
    [],
  );
  const [fieldErrors, setFieldErrors] =
    useState<ManagedPopulationTypeFieldErrors>({});
  const [husbandryJobLinkError, setHusbandryJobLinkError] = useState<
    string | undefined
  >(undefined);
  const [cullingJobLinkError, setCullingJobLinkError] = useState<
    string | undefined
  >(undefined);

  const derivedSlug = toSlug(name, {
    maxLength: managedPopulationInputLimits.populationTypeSlugMax,
  });

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
        cullingOutputs.length > 0
          ? cullingOutputs.map((e) => ({
              amountPerNAnimals: parseFloat(e.amount),
              resourceId: e.resourceId,
            }))
          : undefined,
      growthRate,
      husbandryJobId,
      husbandryWorkersPerNAnimals:
        husbandryWorkersPerNAnimals !== ""
          ? parseInt(husbandryWorkersPerNAnimals, 10)
          : 0,
      maintenanceRulesJson:
        maintenanceRules.length > 0
          ? maintenanceRules.map((e) => ({
              amountPerNAnimals: parseFloat(e.amount),
              resourceId: e.resourceId,
            }))
          : undefined,
      name,
      slug: derivedSlug,
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create managed population type</DialogTitle>
            <DialogDescription className="sr-only">
              Define a managed population type and its resource behavior.
            </DialogDescription>
          </DialogHeader>
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
              slug={derivedSlug}
              worldId={worldId}
              onCullingJobChange={handleCullingJobChange}
              onGrowthRateChange={setGrowthRate}
              onHusbandryJobChange={handleHusbandryJobChange}
              onHusbandryWorkersPerNAnimalsChange={
                setHusbandryWorkersPerNAnimals
              }
              onNameChange={setName}
            />
            <ResourceAmountListEditor
              addLabel="Add entry"
              amountLabel="amount per N animals"
              disabled={isPending}
              entries={maintenanceRules}
              label="Maintenance rules"
              resources={resources}
              onChange={setMaintenanceRules}
            />
            <ResourceAmountListEditor
              addLabel="Add entry"
              amountLabel="amount per N animals"
              disabled={isPending}
              entries={cullingOutputs}
              label="Culling outputs"
              resources={resources}
              onChange={setCullingOutputs}
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
            <Button disabled={isPending || hasJobError} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(
      toSlug(value, {
        maxLength: managedPopulationInputLimits.populationTypeSlugMax,
      }),
    );
  }

  const [husbandryJobId, setHusbandryJobId] = useState(
    populationType.husbandryJobId,
  );
  const [cullingJobId, setCullingJobId] = useState(populationType.cullingJobId);
  const [husbandryWorkersPerNAnimals, setHusbandryWorkersPerNAnimals] =
    useState(String(populationType.husbandryWorkersPerNAnimals));
  const [growthRate, setGrowthRate] = useState(populationType.growthRate);
  const [maintenanceRules, setMaintenanceRules] = useState<
    ResourceAmountEntry[]
  >(
    populationType.maintenanceRulesJson.map((e) => ({
      amount: String(e.amountPerNAnimals),
      id: generateLocalId(),
      resourceId: e.resourceId,
    })),
  );
  const [cullingOutputs, setCullingOutputs] = useState<ResourceAmountEntry[]>(
    populationType.cullingOutputsJson.map((e) => ({
      amount: String(e.amountPerNAnimals),
      id: generateLocalId(),
      resourceId: e.resourceId,
    })),
  );
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
      cullingOutputsJson: cullingOutputs.map((e) => ({
        amountPerNAnimals: parseFloat(e.amount),
        resourceId: e.resourceId,
      })),
      growthRate,
      husbandryJobId,
      husbandryWorkersPerNAnimals:
        husbandryWorkersPerNAnimals !== ""
          ? parseInt(husbandryWorkersPerNAnimals, 10)
          : undefined,
      maintenanceRulesJson: maintenanceRules.map((e) => ({
        amountPerNAnimals: parseFloat(e.amount),
        resourceId: e.resourceId,
      })),
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
          onNameChange={handleNameChange}
        />
        <ResourceAmountListEditor
          addLabel="Add entry"
          amountLabel="amount per N animals"
          disabled={isPending}
          entries={maintenanceRules}
          label="Maintenance rules"
          resources={resources}
          onChange={setMaintenanceRules}
        />
        <ResourceAmountListEditor
          addLabel="Add entry"
          amountLabel="amount per N animals"
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
