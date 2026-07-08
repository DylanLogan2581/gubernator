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

import { createReligionMutationOptions } from "../../mutations/religionsMutations";
import { religionsByWorldQueryOptions } from "../../queries/religionsQueries";

import { CreateReligionForm } from "./CreateReligionForm";
import { ReligionsTable } from "./ReligionsTable";

import type { CreateReligionInput } from "../../schemas/religionSchemas";

type ReligionsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ReligionsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ReligionsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [showForm, setShowForm] = useState(false);

  const religionsQuery = useQuery(religionsByWorldQueryOptions(worldId));
  const createMutation = useMutation(
    createReligionMutationOptions({ queryClient }),
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Religions</h2>
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
            Add religion
          </Button>
        ) : null}
      </div>

      {religionsQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={5} />
      ) : religionsQuery.isError ? (
        <ErrorState
          title="Religions could not be loaded"
          description={getErrorDescription(religionsQuery.error)}
        />
      ) : religionsQuery.data.length === 0 ? (
        <EmptyState
          title="No religions yet"
          description="Add the first religion for this world."
        />
      ) : (
        <ReligionsTable
          canEdit={canEdit}
          religions={religionsQuery.data}
          queryClient={queryClient}
          worldId={worldId}
        />
      )}

      {canEdit && showForm ? (
        <CreateReligionForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateReligionInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, "Failed to create religion.");
              },
              onSuccess: () => {
                notifyMutationSuccess("Religion created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
