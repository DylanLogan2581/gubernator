import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  createOfficeTypeMutationOptions,
  deleteOfficeTypeMutationOptions,
  updateOfficeTypeMutationOptions,
} from "../mutations/officeTypesMutations";
import { worldDefaultOfficeTypesQueryOptions } from "../queries/officeTypesQueries";
import { formatNationOfficeType } from "../types/nationOfficeTypes";

import type { OfficeType } from "../types/nationOfficeTypes";

type OfficeTypesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

// World-default office types (#1114): nation_id-null office_types rows,
// available to every nation. Nation-owned custom offices are managed from
// each nation's government tab instead (OfficesSection.tsx).
export function OfficeTypesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: OfficeTypesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const officeTypesQuery = useQuery(
    worldDefaultOfficeTypesQueryOptions(worldId),
  );

  const createMutation = useMutation(
    createOfficeTypeMutationOptions({ queryClient }),
  );
  const updateMutation = useMutation(
    updateOfficeTypeMutationOptions({ queryClient }),
  );
  const deleteMutation = useMutation(
    deleteOfficeTypeMutationOptions({ queryClient }),
  );

  const [name, setName] = useState("");
  const [excludesFromLabor, setExcludesFromLabor] = useState(true);

  const canEdit = canAdmin && !isArchived;

  if (officeTypesQuery.isPending) {
    return <LoadingState label="Loading office types…" />;
  }

  if (officeTypesQuery.isError) {
    return (
      <ErrorState
        title="Office types could not be loaded"
        description={getErrorDescription(officeTypesQuery.error)}
      />
    );
  }

  const officeTypes = officeTypesQuery.data;

  function handleCreate(): void {
    const trimmed = name.trim();
    if (trimmed === "") return;
    createMutation.mutate(
      {
        excludesFromLabor,
        nationId: null,
        name: trimmed,
        scope: "nation",
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to create office type.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${trimmed} created.`);
          setName("");
          setExcludesFromLabor(true);
        },
      },
    );
  }

  function handleToggleExcludesFromLabor(type: OfficeType): void {
    updateMutation.mutate(
      {
        excludesFromLabor: !type.excludesFromLabor,
        id: type.id,
        nationId: type.nationId,
        worldId: type.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update office type.");
        },
      },
    );
  }

  function handleDelete(type: OfficeType): void {
    deleteMutation.mutate(
      { id: type.id, nationId: type.nationId, worldId: type.worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to delete office type.");
        },
        onSuccess: () => {
          notifyMutationSuccess(
            `${formatNationOfficeType(type.name)} deleted.`,
          );
        },
      },
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        World-default office types are available to every nation. Nations can
        additionally invent their own custom offices from their government tab.
      </p>

      <ul className="grid gap-2">
        {officeTypes.map((type) => (
          <li
            key={type.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
          >
            <span className="font-medium">
              {formatNationOfficeType(type.name)}
            </span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={type.excludesFromLabor}
                  disabled={!canEdit || updateMutation.isPending}
                  onCheckedChange={() => handleToggleExcludesFromLabor(type)}
                />
                Excludes from labor
              </label>
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDelete(type)}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="grid gap-2 border-t border-border pt-3">
          <h3 className="text-sm font-medium">New default office type</h3>
          <div className="grid gap-1">
            <Label htmlFor="new-default-office-type-name">Name</Label>
            <Input
              id="new-default-office-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="governor"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="new-default-office-type-excludes-labor"
              checked={excludesFromLabor}
              onCheckedChange={(checked) =>
                setExcludesFromLabor(checked === true)
              }
            />
            <Label htmlFor="new-default-office-type-excludes-labor">
              Excludes holder from labor
            </Label>
          </div>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending || name.trim() === ""}
            className="w-fit"
          >
            {createMutation.isPending ? "Creating…" : "Create office type"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
