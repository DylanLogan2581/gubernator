import { useMutation, type QueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  hardDeleteResourceMutationOptions,
  restoreResourceMutationOptions,
  softDeleteResourceMutationOptions,
} from "../../mutations/resourcesMutations";
import { buildCleanupDescription } from "../../utils/cleanupDescription";

import { EditResourceForm } from "./EditResourceForm";

import type { Resource } from "../../types/resourceTypes";

type ResourceListProps = {
  readonly canEdit: boolean;
  readonly editingResourceId: string | null;
  readonly onEditingChange: (id: string | null) => void;
  readonly queryClient: QueryClient;
  readonly resources: readonly Resource[];
  readonly showTrash: boolean;
  readonly worldId: string;
};

export function ResourceList({
  canEdit,
  editingResourceId,
  queryClient,
  resources,
  showTrash,
  worldId,
  onEditingChange,
}: ResourceListProps): JSX.Element {
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

type ResourceRowProps = {
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly resource: Resource;
  readonly worldId: string;
};

function ResourceRow({
  canEdit,
  queryClient,
  resource,
  worldId,
  onEdit,
}: ResourceRowProps): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteResourceMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { resourceId: resource.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to move resource to trash.");
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

type TrashedResourceRowProps = {
  readonly queryClient: QueryClient;
  readonly resource: Resource;
  readonly worldId: string;
};

function TrashedResourceRow({
  queryClient,
  resource,
  worldId,
}: TrashedResourceRowProps): JSX.Element {
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
          handleCrudError(error, "Failed to restore resource.");
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
          handleCrudError(error, "Failed to delete resource.");
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
