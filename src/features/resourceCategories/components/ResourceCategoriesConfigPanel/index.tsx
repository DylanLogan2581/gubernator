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

import { createResourceCategoryMutationOptions } from "../../mutations/resourceCategoriesMutations";
import { resourceCategoriesByWorldQueryOptions } from "../../queries/resourceCategoriesQueries";

import { CreateResourceCategoryForm } from "./CreateResourceCategoryForm";
import { ResourceCategoriesTable } from "./ResourceCategoriesTable";

import type { CreateResourceCategoryInput } from "../../schemas/resourceCategorySchemas";

type ResourceCategoriesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ResourceCategoriesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ResourceCategoriesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [showForm, setShowForm] = useState(false);

  const categoriesQuery = useQuery(
    resourceCategoriesByWorldQueryOptions(worldId),
  );
  const createMutation = useMutation(
    createResourceCategoryMutationOptions({ queryClient }),
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">
          Resource categories
        </h2>
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
            Add category
          </Button>
        ) : null}
      </div>

      {categoriesQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={5} />
      ) : categoriesQuery.isError ? (
        <ErrorState
          title="Resource categories could not be loaded"
          description={getErrorDescription(categoriesQuery.error)}
        />
      ) : categoriesQuery.data.length === 0 ? (
        <EmptyState
          title="No resource categories yet"
          description="Add the first category to group resources in this world."
        />
      ) : (
        <ResourceCategoriesTable
          canEdit={canEdit}
          categories={categoriesQuery.data}
          queryClient={queryClient}
          worldId={worldId}
        />
      )}

      {canEdit && showForm ? (
        <CreateResourceCategoryForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateResourceCategoryInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, "Failed to create resource category.");
              },
              onSuccess: () => {
                notifyMutationSuccess("Resource category created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
