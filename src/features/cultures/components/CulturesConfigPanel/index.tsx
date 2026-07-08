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

import { createCultureMutationOptions } from "../../mutations/culturesMutations";
import { culturesByWorldQueryOptions } from "../../queries/culturesQueries";

import { CreateCultureForm } from "./CreateCultureForm";
import { CulturesTable } from "./CulturesTable";

import type { CreateCultureInput } from "../../schemas/cultureSchemas";

type CulturesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function CulturesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: CulturesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [showForm, setShowForm] = useState(false);

  const culturesQuery = useQuery(culturesByWorldQueryOptions(worldId));
  const createMutation = useMutation(
    createCultureMutationOptions({ queryClient }),
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Cultures</h2>
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
            Add culture
          </Button>
        ) : null}
      </div>

      {culturesQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={5} />
      ) : culturesQuery.isError ? (
        <ErrorState
          title="Cultures could not be loaded"
          description={getErrorDescription(culturesQuery.error)}
        />
      ) : culturesQuery.data.length === 0 ? (
        <EmptyState
          title="No cultures yet"
          description="Add the first culture for this world."
        />
      ) : (
        <CulturesTable
          canEdit={canEdit}
          cultures={culturesQuery.data}
          queryClient={queryClient}
          worldId={worldId}
        />
      )}

      {canEdit && showForm ? (
        <CreateCultureForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateCultureInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, "Failed to create culture.");
              },
              onSuccess: () => {
                notifyMutationSuccess("Culture created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
