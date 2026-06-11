import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import {
  ConfigCrudPanel,
  handleCrudError,
} from "@/components/shared/ConfigCrudPanel";
import { notifyMutationSuccess } from "@/lib/notify";

import { createNamesetMutationOptions } from "../../mutations/namesetsMutations";
import { namesetsByWorldQueryOptions } from "../../queries/namesetsQueries";

import { CreateNamesetDialog } from "./NamesetForm";
import { NamesetList } from "./NamesetList";
import { formatMutationError } from "./utils/FormatMutationError";

import type { Nameset } from "../../types/namesetTypes";

type NamesetsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function NamesetsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: NamesetsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const namesetsQuery = useQuery(namesetsByWorldQueryOptions(worldId));
  const canEdit = canAdmin && !isArchived;
  const createMutation = useMutation(
    createNamesetMutationOptions({ queryClient }),
  );

  return (
    <ConfigCrudPanel<Nameset>
      addButtonLabel="Add nameset"
      allData={namesetsQuery}
      canEdit={canEdit}
      emptyTitle="No namesets yet"
      emptyDescription="Add the first nameset for this world."
      headerTitle="Namesets"
      isTrashed={(ns) => ns.isTrashed}
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
          <p className="text-sm text-muted-foreground">
            {canEditProp
              ? "Namesets bundle naming pools and a convention. Nations and settlements can override the world default."
              : "Namesets define the naming pools and convention used for random NPC creation."}
          </p>

          {items.length > 0 ? (
            <NamesetList
              canEdit={canEditProp}
              editingNamesetId={editingId}
              namesets={items}
              queryClient={qc}
              showTrash={showTrash}
              worldId={worldId}
              onEditingChange={setEditingId}
            />
          ) : null}

          {canEditProp && showForm && !showTrash ? (
            <CreateNamesetDialog
              isPending={createMutation.isPending}
              onCancel={() => {
                setShowForm(false);
              }}
              onSubmit={(name, configJson) => {
                createMutation.mutate(
                  { worldId, name, configJson },
                  {
                    onError: (error) => {
                      handleCrudError(error, formatMutationError(error));
                    },
                    onSuccess: () => {
                      notifyMutationSuccess("Nameset created.");
                      setShowForm(false);
                    },
                  },
                );
              }}
            />
          ) : null}
        </>
      )}
    />
  );
}
