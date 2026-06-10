import { useMutation, type QueryClient } from "@tanstack/react-query";
import { RotateCcw, Star, Trash2 } from "lucide-react";
import { type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  hardDeleteNamesetMutationOptions,
  restoreNamesetMutationOptions,
  setDefaultNamesetMutationOptions,
  softDeleteNamesetMutationOptions,
} from "../../mutations/namesetsMutations";

import { EditNamesetForm } from "./NamesetForm";

import type { Nameset } from "../../types/namesetTypes";

export function NamesetList({
  canEdit,
  editingNamesetId,
  namesets,
  queryClient,
  showTrash,
  worldId,
  onEditingChange,
}: {
  readonly canEdit: boolean;
  readonly editingNamesetId: string | null;
  readonly namesets: readonly Nameset[];
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
  readonly onEditingChange: (id: string | null) => void;
}): JSX.Element {
  return (
    <ul aria-label="Namesets" className="grid gap-2">
      {namesets.map((nameset) => {
        if (showTrash) {
          return (
            <TrashedNamesetRow
              key={nameset.id}
              nameset={nameset}
              queryClient={queryClient}
              worldId={worldId}
            />
          );
        }
        return editingNamesetId === nameset.id ? (
          <li key={nameset.id}>
            <EditNamesetForm
              nameset={nameset}
              queryClient={queryClient}
              worldId={worldId}
              onClose={() => {
                onEditingChange(null);
              }}
            />
          </li>
        ) : (
          <NamesetRow
            key={nameset.id}
            canEdit={canEdit}
            nameset={nameset}
            queryClient={queryClient}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(nameset.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function NamesetRow({
  canEdit,
  nameset,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly nameset: Nameset;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteNamesetMutationOptions({ queryClient }),
  );
  const setDefaultMutation = useMutation(
    setDefaultNamesetMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to move nameset to trash.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset moved to trash.");
        },
      },
    );
  }

  function handleSetDefault(): void {
    setDefaultMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to set default nameset.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Default nameset updated.");
        },
      },
    );
  }

  const isPending =
    softDeleteMutation.isPending || setDefaultMutation.isPending;

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{nameset.name}</span>
          {nameset.isDefault ? (
            <Badge variant="secondary">default</Badge>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {nameset.configJson.convention}
          {" · "}
          {nameset.configJson.male_given_names.length +
            nameset.configJson.female_given_names.length}{" "}
          given names
        </span>
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2">
          {!nameset.isDefault ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Set ${nameset.name} as world default`}
              title="Set as world default"
              disabled={isPending}
              onClick={handleSetDefault}
            >
              <Star aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              nameset.isDefault
                ? `${nameset.name} is the world default and cannot be trashed`
                : `Move ${nameset.name} to trash`
            }
            title={
              nameset.isDefault
                ? "Set another nameset as default first"
                : "Move to trash"
            }
            disabled={nameset.isDefault || isPending}
            onClick={nameset.isDefault ? undefined : handleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function TrashedNamesetRow({
  nameset,
  queryClient,
  worldId,
}: {
  readonly nameset: Nameset;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreNamesetMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteNamesetMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to restore nameset.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to delete nameset.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <span className="text-sm font-medium">{nameset.name}</span>
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
