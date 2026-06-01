import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { DialogShell } from "@/components/shared/DialogShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { SlugHint } from "@/components/shared/SlugHint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorDescription } from "@/lib/errorUtils";
import { resourceInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { toSlug } from "@/lib/slugify";

import {
  createResourceMutationOptions,
  hardDeleteResourceMutationOptions,
  restoreResourceMutationOptions,
  softDeleteResourceMutationOptions,
  updateResourceMutationOptions,
} from "../mutations/resourcesMutations";
import { resourcesByWorldQueryOptions } from "../queries/resourcesQueries";
import {
  createResourceInputSchema,
  updateResourceInputSchema,
  type CreateResourceInput,
  type UpdateResourceInput,
} from "../schemas/resourceSchemas";

import type { Resource, ResourceCleanupSummary } from "../types/resourceTypes";

type ResourcesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ResourcesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ResourcesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const resourcesQuery = useQuery(resourcesByWorldQueryOptions(worldId));

  if (resourcesQuery.isPending) {
    return <LoadingState label="Loading resources…" />;
  }

  if (resourcesQuery.isError) {
    return (
      <ErrorState
        title="Resources could not be loaded"
        description={getErrorDescription(resourcesQuery.error)}
      />
    );
  }

  return (
    <ResourcesConfigPanelContent
      canAdmin={canAdmin}
      isArchived={isArchived}
      queryClient={queryClient}
      allResources={resourcesQuery.data}
      worldId={worldId}
    />
  );
}

function ResourcesConfigPanelContent({
  canAdmin,
  isArchived,
  queryClient,
  allResources,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly allResources: readonly Resource[];
  readonly worldId: string;
}): JSX.Element {
  const createMutation = useMutation(
    createResourceMutationOptions({ queryClient }),
  );
  const [showForm, setShowForm] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const canEdit = canAdmin && !isArchived;

  const resources = showTrash
    ? allResources.filter((r) => r.isTrashed)
    : allResources.filter((r) => !r.isTrashed);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2
          id="world-resources-title"
          className="text-lg font-semibold tracking-normal"
        >
          Resources
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
              Add resource
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant={showTrash ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={showTrash ? "Hide trash" : "Show trash"}
              aria-pressed={showTrash}
              title={showTrash ? "Hide trash" : "Show trash"}
              onClick={() => {
                setShowTrash((v) => !v);
                setEditingResourceId(null);
                setShowForm(false);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      {resources.length > 0 ? (
        <ResourceList
          canEdit={canEdit}
          editingResourceId={editingResourceId}
          queryClient={queryClient}
          resources={resources}
          showTrash={showTrash}
          worldId={worldId}
          onEditingChange={setEditingResourceId}
        />
      ) : (
        <EmptyState
          title={showTrash ? "No resources in trash" : "No resources yet"}
          description={
            showTrash ? undefined : "Add the first resource for this world."
          }
        />
      )}

      {canEdit && showForm && !showTrash ? (
        <CreateResourceForm
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
                    : "Failed to create resource.",
                );
              },
              onSuccess: () => {
                notifyMutationSuccess("Resource created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}

function ResourceList({
  canEdit,
  editingResourceId,
  queryClient,
  resources,
  showTrash,
  worldId,
  onEditingChange,
}: {
  readonly canEdit: boolean;
  readonly editingResourceId: string | null;
  readonly onEditingChange: (id: string | null) => void;
  readonly queryClient: QueryClient;
  readonly resources: readonly Resource[];
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  return (
    <ul aria-label="Resources" className="grid gap-2">
      {resources.map((resource) => {
        if (showTrash) {
          return (
            <TrashedResourceRow
              key={resource.id}
              queryClient={queryClient}
              resource={resource}
              worldId={worldId}
            />
          );
        }
        return editingResourceId === resource.id ? (
          <li key={resource.id}>
            <EditResourceForm
              queryClient={queryClient}
              resource={resource}
              worldId={worldId}
              onClose={() => {
                onEditingChange(null);
              }}
            />
          </li>
        ) : (
          <ResourceRow
            key={resource.id}
            canEdit={canEdit}
            queryClient={queryClient}
            resource={resource}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(resource.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function ResourceRow({
  canEdit,
  queryClient,
  resource,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly resource: Resource;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteResourceMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { resourceId: resource.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to move resource to trash.",
          );
        },
        onSuccess: (result) => {
          const description = buildCleanupDescription(result.cleanupSummary);
          notifyMutationSuccess(
            "Resource moved to trash.",
            description !== undefined ? { description } : undefined,
          );
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{resource.name}</span>
          {resource.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-sm text-muted-foreground">
          {resource.baseStockpileCap.toLocaleString()}
        </span>
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
            aria-label={
              resource.isSystemResource
                ? `${resource.name} is a system resource and cannot be deleted`
                : `Move ${resource.name} to trash`
            }
            title={
              resource.isSystemResource
                ? "System resources cannot be deleted"
                : "Move to trash"
            }
            disabled={resource.isSystemResource || softDeleteMutation.isPending}
            onClick={resource.isSystemResource ? undefined : handleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function TrashedResourceRow({
  queryClient,
  resource,
  worldId,
}: {
  readonly queryClient: QueryClient;
  readonly resource: Resource;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreResourceMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteResourceMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { resourceId: resource.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to restore resource.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Resource restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { resourceId: resource.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to delete resource.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Resource permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{resource.name}</span>
          {resource.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
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
          <RotateCcw aria-hidden="true" />
          Restore
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleHardDelete}
        >
          <Trash2 aria-hidden="true" />
          Delete permanently
        </Button>
      </div>
    </li>
  );
}

type ResourceFieldErrors = {
  readonly baseStockpileCap?: string;
  readonly name?: string;
  readonly slug?: string;
};

function EditResourceForm({
  onClose,
  queryClient,
  resource,
  worldId,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly resource: Resource;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(
    updateResourceMutationOptions({ queryClient }),
  );
  const softDeleteMutation = useMutation(
    softDeleteResourceMutationOptions({ queryClient }),
  );

  const [name, setName] = useState(resource.name);
  const [slug, setSlug] = useState(resource.slug);
  const [baseStockpileCap, setBaseStockpileCap] = useState(
    String(resource.baseStockpileCap),
  );
  const [fieldErrors, setFieldErrors] = useState<ResourceFieldErrors>({});

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(toSlug(value, { maxLength: resourceInputLimits.resourceSlugMax }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFieldErrors({});

    const input: UpdateResourceInput = {
      baseStockpileCap: baseStockpileCap !== "" ? baseStockpileCap : undefined,
      name,
      resourceId: resource.id,
      slug,
      worldId,
    };

    const result = updateResourceInputSchema.safeParse(input);
    if (!result.success) {
      let nameError: string | undefined;
      let slugError: string | undefined;
      let baseStockpileCapError: string | undefined;
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "name") nameError ??= issue.message;
        else if (field === "slug") slugError ??= issue.message;
        else if (field === "baseStockpileCap")
          baseStockpileCapError ??= issue.message;
      }
      setFieldErrors({
        baseStockpileCap: baseStockpileCapError,
        name: nameError,
        slug: slugError,
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Resource saved.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save resource.",
      );
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      const result = await softDeleteMutation.mutateAsync({
        resourceId: resource.id,
        worldId,
      });
      const description = buildCleanupDescription(result.cleanupSummary);
      notifyMutationSuccess(
        "Resource moved to trash.",
        description !== undefined ? { description } : undefined,
      );
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to move resource to trash.",
      );
    }
  }

  return (
    <form
      aria-label="Edit resource"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit resource</h3>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
            aria-invalid={fieldErrors.name !== undefined}
            aria-label="Name"
            disabled={isPending}
            maxLength={resourceInputLimits.resourceNameMax}
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
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Base stockpile cap</span>
          <Input
            aria-invalid={fieldErrors.baseStockpileCap !== undefined}
            disabled={isPending}
            inputMode="decimal"
            placeholder="0"
            value={baseStockpileCap}
            onChange={(e) => {
              setBaseStockpileCap(e.currentTarget.value);
            }}
          />
          {fieldErrors.baseStockpileCap !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.baseStockpileCap}
            </p>
          ) : null}
        </label>
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
          disabled={resource.isSystemResource || isPending}
          title={
            resource.isSystemResource
              ? "System resources cannot be deleted"
              : undefined
          }
          onClick={
            resource.isSystemResource
              ? undefined
              : () => {
                  void handleTrash();
                }
          }
        >
          <Trash2 aria-hidden="true" />
          Move to trash
        </Button>
      </div>
    </form>
  );
}

type FieldErrors = {
  readonly baseStockpileCap?: string;
  readonly name?: string;
  readonly slug?: string;
};

function CreateResourceForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateResourceInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const [name, setName] = useState("");
  const [baseStockpileCap, setBaseStockpileCap] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const derivedSlug = toSlug(name, {
    maxLength: resourceInputLimits.resourceSlugMax,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldErrors({});

    const input: CreateResourceInput = {
      baseStockpileCap: baseStockpileCap !== "" ? baseStockpileCap : undefined,
      name,
      slug: derivedSlug,
      worldId,
    };

    const result = createResourceInputSchema.safeParse(input);
    if (!result.success) {
      let nameError: string | undefined;
      let slugError: string | undefined;
      let baseStockpileCapError: string | undefined;
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === "name") nameError ??= issue.message;
        else if (field === "slug") slugError ??= issue.message;
        else if (field === "baseStockpileCap")
          baseStockpileCapError ??= issue.message;
      }
      setFieldErrors({
        baseStockpileCap: baseStockpileCapError,
        name: nameError,
        slug: slugError,
      });
      return;
    }

    onSubmit(input);
  }

  const titleId = useId();

  return (
    <DialogShell>
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-lg gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        noValidate
        onSubmit={handleSubmit}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold">
            Create resource
          </h3>
          <Button
            aria-label="Cancel create resource"
            disabled={isPending}
            onClick={onCancel}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input
              aria-invalid={fieldErrors.name !== undefined}
              aria-label="Name"
              disabled={isPending}
              maxLength={resourceInputLimits.resourceNameMax}
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
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Base stockpile cap</span>
            <Input
              aria-invalid={fieldErrors.baseStockpileCap !== undefined}
              disabled={isPending}
              inputMode="decimal"
              placeholder="0"
              value={baseStockpileCap}
              onChange={(e) => {
                setBaseStockpileCap(e.currentTarget.value);
              }}
            />
            {fieldErrors.baseStockpileCap !== undefined ? (
              <p className="text-xs text-destructive">
                {fieldErrors.baseStockpileCap}
              </p>
            ) : null}
          </label>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={isPending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isPending} type="submit">
            Create
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

function buildCleanupDescription(
  summary: ResourceCleanupSummary,
): string | undefined {
  type Entry = {
    readonly count: number;
    readonly singular: string;
    readonly plural: string;
  };
  const entries: Entry[] = [
    {
      count: summary.jobDefinitionsInputsCleaned,
      plural: "job inputs",
      singular: "job input",
    },
    {
      count: summary.jobDefinitionsOutputsCleaned,
      plural: "job outputs",
      singular: "job output",
    },
    {
      count: summary.buildingTierConstructionCostsCleaned,
      plural: "tier construction costs",
      singular: "tier construction cost",
    },
    {
      count: summary.buildingTierUpkeepCostsCleaned,
      plural: "tier upkeep costs",
      singular: "tier upkeep cost",
    },
    {
      count: summary.buildingTierEffectsCleaned,
      plural: "tier effects",
      singular: "tier effect",
    },
    {
      count: summary.depositTypesWorkerInputsCleaned,
      plural: "deposit worker inputs",
      singular: "deposit worker input",
    },
    {
      count: summary.managedPopulationMaintenanceCleaned,
      plural: "population maintenance rules",
      singular: "population maintenance rule",
    },
    {
      count: summary.managedPopulationCullingOutputsCleaned,
      plural: "population culling outputs",
      singular: "population culling output",
    },
  ];

  const parts = entries
    .filter((e) => e.count > 0)
    .map((e) => `${e.count} ${e.count === 1 ? e.singular : e.plural}`);

  if (parts.length === 0) return undefined;
  return `Removed ${parts.join(", ")}.`;
}
