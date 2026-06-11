import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import {
  ConfigCrudPanel,
  handleCrudError,
} from "@/components/shared/ConfigCrudPanel";
import { notifyMutationSuccess } from "@/lib/notify";

import { createResourceMutationOptions } from "../../mutations/resourcesMutations";
import { resourcesByWorldQueryOptions } from "../../queries/resourcesQueries";

import { CreateResourceForm } from "./CreateResourceForm";
import { ResourceList } from "./ResourceList";

import type { CreateResourceInput } from "../../schemas/resourceSchemas";
import type { Resource } from "../../types/resourceTypes";

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
  const canEdit = canAdmin && !isArchived;
  const createMutation = useMutation(
    createResourceMutationOptions({ queryClient }),
  );

  return (
    <ConfigCrudPanel<Resource>
      addButtonLabel="Add resource"
      allData={resourcesQuery}
      canEdit={canEdit}
      emptyTitle="No resources yet"
      emptyDescription="Add the first resource for this world."
      headerTitle="Resources"
      isTrashed={(resource) => resource.isTrashed}
      renderContent={({
        canEdit: canEditProp,
        editingId,
        items,
        queryClient: qc,
        setEditingId,
        setShowForm,
        showForm,
        showTrash,
      }) => (
        <>
          {items.length > 0 ? (
            <ResourceList
              canEdit={canEditProp}
              editingResourceId={editingId}
              queryClient={qc}
              resources={items}
              showTrash={showTrash}
              worldId={worldId}
              onEditingChange={setEditingId}
            />
          ) : null}

          {canEditProp && showForm && !showTrash ? (
            <CreateResourceForm
              isPending={createMutation.isPending}
              worldId={worldId}
              onCancel={() => {
                setShowForm(false);
              }}
              onSubmit={(input: CreateResourceInput) => {
                createMutation.mutate(input, {
                  onError: (error) => {
                    handleCrudError(error, "Failed to create resource.");
                  },
                  onSuccess: () => {
                    notifyMutationSuccess("Resource created.");
                    setShowForm(false);
                  },
                });
              }}
            />
          ) : null}
        </>
      )}
    />
  );
}
