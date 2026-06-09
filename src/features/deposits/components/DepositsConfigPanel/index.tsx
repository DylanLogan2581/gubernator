import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import {
  ConfigCrudPanel,
  handleCrudError,
} from "@/components/shared/ConfigCrudPanel";
import { jobsByTypeQueryOptions } from "@/features/jobs";
import { notifyMutationSuccess } from "@/lib/notify";

import { createDepositTypeMutationOptions } from "../../mutations/depositsMutations";
import { depositTypesByWorldQueryOptions } from "../../queries/depositsQueries";

import { CreateDepositTypeForm } from "./CreateDepositTypeForm";
import { DepositTypeRow } from "./DepositTypeRow";
import { EditDepositTypeForm } from "./EditDepositTypeForm";
import { TrashedDepositTypeRow } from "./TrashedDepositTypeRow";

import type { DepositType } from "../../types/depositTypes";

type DepositsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function DepositsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: DepositsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const depositTypesQuery = useQuery(depositTypesByWorldQueryOptions(worldId));
  const depositJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "deposit"));
  const canEdit = canAdmin && !isArchived;
  const createMutation = useMutation(
    createDepositTypeMutationOptions({ queryClient }),
  );
  const depositJobs = depositJobsQuery.data ?? [];

  return (
    <ConfigCrudPanel<DepositType>
      addButtonLabel="Add deposit type"
      allData={depositTypesQuery}
      canEdit={canEdit}
      emptyTitle="No deposit types yet"
      emptyDescription="Add the first deposit type for this world."
      headerTitle="Deposit Types"
      isTrashed={(dt) => dt.isTrashed}
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
            <ul aria-label="Deposit types" className="grid gap-2">
              {items.map((depositType) => {
                if (editingId === depositType.id) {
                  return (
                    <li key={depositType.id}>
                      <EditDepositTypeForm
                        allDepositTypes={items}
                        depositJobs={depositJobs}
                        depositType={depositType}
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
                    <li key={depositType.id}>
                      <TrashedDepositTypeRow
                        depositType={depositType}
                        queryClient={qc}
                        worldId={worldId}
                      />
                    </li>
                  );
                }
                return (
                  <li key={depositType.id}>
                    <DepositTypeRow
                      canEdit={canEditProp}
                      depositJobs={depositJobs}
                      depositType={depositType}
                      queryClient={qc}
                      worldId={worldId}
                      onEdit={() => {
                        setEditingId(depositType.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}

          {canEditProp && showForm && !showTrash ? (
            <CreateDepositTypeForm
              allDepositTypes={items}
              depositJobs={depositJobs}
              isPending={createMutation.isPending}
              worldId={worldId}
              onCancel={() => {
                setShowForm(false);
              }}
              onSubmit={(input) => {
                createMutation.mutate(input, {
                  onError: (error) => {
                    handleCrudError(error, "Failed to create deposit type.");
                  },
                  onSuccess: () => {
                    notifyMutationSuccess("Deposit type created.");
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
