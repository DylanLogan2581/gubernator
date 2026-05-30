import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createResourceInputSchema,
  createResourceMutationOptions,
  hardDeleteResourceMutationOptions,
  resourcesByWorldQueryOptions,
  restoreResourceMutationOptions,
  softDeleteResourceMutationOptions,
  updateResourceInputSchema,
  updateResourceMutationOptions,
  type CreateResourceInput,
  type Resource,
  type UpdateResourceInput,
} from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { resourceInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";

type WorldResourcesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldResourcesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: WorldResourcesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const resourcesQuery = useQuery(resourcesByWorldQueryOptions(worldId));

  if (resourcesQuery.isPending) {
    return (
      <section
        aria-labelledby="world-resources-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading resources…" />
      </section>
    );
  }

  if (resourcesQuery.isError) {
    return (
      <section
        aria-labelledby="world-resources-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Resources could not be loaded"
          description={getErrorDescription(resourcesQuery.error)}
        />
      </section>
    );
  }

  return (
    <WorldResourcesConfigPanelContent
      canAdmin={canAdmin}
      isArchived={isArchived}
      queryClient={queryClient}
      allResources={resourcesQuery.data}
      worldId={worldId}
    />
  );
}

function WorldResourcesConfigPanelContent({
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
    ? allResources.filter((r) => r.isDeleted)
    : allResources.filter((r) => !r.isDeleted);

  return (
    <section
      aria-labelledby="world-resources-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex items-center justify-between">
        <h2
          id="world-resources-title"
          className="text-lg font-semibold tracking-normal"
        >
          Resources
        </h2>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowTrash((v) => !v);
                setEditingResourceId(null);
                setShowForm(false);
              }}
            >
              {showTrash ? "Hide trash" : "View trash"}
            </Button>
          ) : null}
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
      ) : !showForm ? (
        <EmptyState
          title={showTrash ? "No trashed resources." : "No resources yet"}
          description={
            showTrash ? undefined : "Add the first resource for this world."
          }
        />
      ) : null}

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
    </section>
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
            resource={resource}
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
  resource,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly resource: Resource;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{resource.name}</span>
          {resource.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{resource.slug}</span>
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
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 opacity-60">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{resource.name}</span>
          {resource.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{resource.slug}</span>
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
      await softDeleteMutation.mutateAsync({
        resourceId: resource.id,
        worldId,
      });
      notifyMutationSuccess("Resource moved to trash.");
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
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Slug</span>
          <Input
            aria-invalid={fieldErrors.slug !== undefined}
            disabled={isPending}
            maxLength={resourceInputLimits.resourceSlugMax}
            value={slug}
            onChange={(e) => {
              setSlug(e.currentTarget.value);
            }}
          />
          {fieldErrors.slug !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.slug}</p>
          ) : null}
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
        {!resource.isSystemResource ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              void handleTrash();
            }}
          >
            <Trash2 aria-hidden="true" />
            Move to trash
          </Button>
        ) : null}
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
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [baseStockpileCap, setBaseStockpileCap] = useState("");
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
    setFieldErrors({});

    const input: CreateResourceInput = {
      baseStockpileCap: baseStockpileCap !== "" ? baseStockpileCap : undefined,
      name,
      slug,
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

  return (
    <form
      aria-label="Create resource"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <h3 className="text-sm font-medium">New resource</h3>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <Input
            aria-invalid={fieldErrors.name !== undefined}
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
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Slug</span>
          <Input
            aria-invalid={fieldErrors.slug !== undefined}
            disabled={isPending}
            maxLength={resourceInputLimits.resourceSlugMax}
            value={slug}
            onChange={(e) => {
              handleSlugChange(e.currentTarget.value);
            }}
          />
          {fieldErrors.slug !== undefined ? (
            <p className="text-xs text-destructive">{fieldErrors.slug}</p>
          ) : null}
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
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
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
    .slice(0, resourceInputLimits.resourceSlugMax);
}
