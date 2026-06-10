import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import {
  ConfigCrudPanel,
  handleCrudError,
} from "@/components/shared/ConfigCrudPanel";
import { jobsByTypeQueryOptions } from "@/features/jobs";
import { notifyMutationSuccess } from "@/lib/notify";

import { createManagedPopulationTypeMutationOptions } from "../../mutations/managedPopulationsMutations";
import { managedPopulationTypesByWorldQueryOptions } from "../../queries/managedPopulationsQueries";

import { CreateManagedPopulationTypeForm } from "./components/CreateManagedPopulationTypeForm";
import { EditManagedPopulationTypeForm } from "./components/EditManagedPopulationTypeForm";
import { ManagedPopulationTypeRow } from "./components/ManagedPopulationTypeRow";
import { TrashedManagedPopulationTypeRow } from "./components/TrashedManagedPopulationTypeRow";

import type { ManagedPopulationType } from "../../types/managedPopulationTypes";

type ManagedPopulationsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ManagedPopulationsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ManagedPopulationsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const populationTypesQuery = useQuery(
    managedPopulationTypesByWorldQueryOptions(worldId),
  );
  const husbandryJobsQuery = useQuery(
    jobsByTypeQueryOptions(worldId, "husbandry"),
  );
  const cullingJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "culling"));
  const canEdit = canAdmin && !isArchived;
  const createMutation = useMutation(
    createManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const husbandryJobs = husbandryJobsQuery.data ?? [];
  const cullingJobs = cullingJobsQuery.data ?? [];

  return (
    <ConfigCrudPanel<ManagedPopulationType>
      addButtonLabel="Add population type"
      allData={populationTypesQuery}
      canEdit={canEdit}
      emptyTitle="No managed population types yet"
      emptyDescription="Add the first managed population type for this world."
      headerTitle="Managed Population Types"
      isTrashed={(pt) => pt.isTrashed}
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
            <ul aria-label="Population types" className="grid gap-2">
              {items.map((populationType) => {
                if (editingId === populationType.id) {
                  return (
                    <li key={populationType.id}>
                      <EditManagedPopulationTypeForm
                        allPopulationTypes={items}
                        cullingJobs={cullingJobs}
                        husbandryJobs={husbandryJobs}
                        populationType={populationType}
                        queryClient={qc}
                        worldId={worldId}
                        onClose={() => {
                          setEditingId(null);
                        }}
                      />
                    </li>
                  );
                }
                if (showTrash) {
                  return (
                    <li key={populationType.id}>
                      <TrashedManagedPopulationTypeRow
                        populationType={populationType}
                        queryClient={qc}
                        worldId={worldId}
                      />
                    </li>
                  );
                }
                return (
                  <li key={populationType.id}>
                    <ManagedPopulationTypeRow
                      canEdit={canEditProp}
                      cullingJobs={cullingJobs}
                      husbandryJobs={husbandryJobs}
                      populationType={populationType}
                      queryClient={qc}
                      worldId={worldId}
                      onEdit={() => {
                        setEditingId(populationType.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}

          {canEditProp && showForm && !showTrash ? (
            <CreateManagedPopulationTypeForm
              allPopulationTypes={items}
              cullingJobs={cullingJobs}
              husbandryJobs={husbandryJobs}
              isPending={createMutation.isPending}
              worldId={worldId}
              onCancel={() => {
                setShowForm(false);
              }}
              onSubmit={(input) => {
                createMutation.mutate(input, {
                  onError: (error) => {
                    handleCrudError(
                      error,
                      "Failed to create managed population type.",
                    );
                  },
                  onSuccess: () => {
                    notifyMutationSuccess("Managed population type created.");
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
