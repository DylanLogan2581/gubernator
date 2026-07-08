import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import { createUnitTypeMutationOptions } from "../../mutations/unitTypesMutations";
import { unitTypesByWorldQueryOptions } from "../../queries/unitTypesQueries";

import { CreateUnitTypeForm } from "./CreateUnitTypeForm";
import { UnitTypesTable } from "./UnitTypesTable";

import type { CreateUnitTypeInput } from "../../schemas/unitTypeSchemas";

type MilitaryConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function MilitaryConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: MilitaryConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [showForm, setShowForm] = useState(false);

  const unitTypesQuery = useQuery(unitTypesByWorldQueryOptions(worldId));
  const createMutation = useMutation(
    createUnitTypeMutationOptions({ queryClient }),
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Military</h2>
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
            Add unit type
          </Button>
        ) : null}
      </div>

      {unitTypesQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={5} />
      ) : unitTypesQuery.isError ? (
        <ErrorState
          title="Unit types could not be loaded"
          description={getErrorDescription(unitTypesQuery.error)}
        />
      ) : unitTypesQuery.data.length === 0 ? (
        <EmptyState
          title="No unit types yet"
          description="Add the first recruitable unit type for this world."
        />
      ) : (
        <UnitTypesTable
          canEdit={canEdit}
          queryClient={queryClient}
          unitTypes={unitTypesQuery.data}
          worldId={worldId}
        />
      )}

      {canEdit && showForm ? (
        <CreateUnitTypeForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateUnitTypeInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, "Failed to create unit type.");
              },
              onSuccess: () => {
                notifyMutationSuccess("Unit type created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
