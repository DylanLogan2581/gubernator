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

import { CreateLoreEntityForm } from "./CreateLoreEntityForm";
import { LoreEntityTable } from "./LoreEntityTable";

import type { LoreEntityBase, LoreEntityDescriptor } from "./LoreEntityTypes";

type LoreEntityConfigPanelProps<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
> = {
  readonly canAdmin: boolean;
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function LoreEntityConfigPanel<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  canAdmin,
  descriptor,
  isArchived,
  worldId,
}: LoreEntityConfigPanelProps<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError
>): JSX.Element {
  const { labels } = descriptor;
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [showForm, setShowForm] = useState(false);

  const entitiesQuery = useQuery(descriptor.queries.byWorld(worldId));
  const createMutation = useMutation(
    descriptor.mutations.create({ queryClient }),
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">
          {labels.pluralCapital}
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
            Add {labels.singular}
          </Button>
        ) : null}
      </div>

      {entitiesQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={5} />
      ) : entitiesQuery.isError ? (
        <ErrorState
          title={`${labels.pluralCapital} could not be loaded`}
          description={getErrorDescription(entitiesQuery.error)}
        />
      ) : entitiesQuery.data.length === 0 ? (
        <EmptyState
          title={`No ${labels.plural} yet`}
          description={`Add the first ${labels.singular} for this world.`}
        />
      ) : (
        <LoreEntityTable
          canEdit={canEdit}
          descriptor={descriptor}
          entities={entitiesQuery.data}
          queryClient={queryClient}
          worldId={worldId}
        />
      )}

      {canEdit && showForm ? (
        <CreateLoreEntityForm
          buildCreateInput={descriptor.buildCreateInput}
          createInputSchema={descriptor.createInputSchema}
          isPending={createMutation.isPending}
          labels={labels}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, `Failed to create ${labels.singular}.`);
              },
              onSuccess: () => {
                notifyMutationSuccess(`${labels.singularCapital} created.`);
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
