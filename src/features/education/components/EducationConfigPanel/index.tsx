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

import { createEducationLevelMutationOptions } from "../../mutations/educationLevelsMutations";
import { educationLevelsByWorldQueryOptions } from "../../queries/educationLevelsQueries";

import { CreateEducationLevelForm } from "./CreateEducationLevelForm";
import { EducationLevelsTable } from "./EducationLevelsTable";

import type { CreateEducationLevelInput } from "../../schemas/educationLevelSchemas";

type EducationConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function EducationConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: EducationConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [showForm, setShowForm] = useState(false);

  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(worldId),
  );
  const createMutation = useMutation(
    createEducationLevelMutationOptions({ queryClient }),
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Education</h2>
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
            Add level
          </Button>
        ) : null}
      </div>

      {educationLevelsQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={5} />
      ) : educationLevelsQuery.isError ? (
        <ErrorState
          title="Education levels could not be loaded"
          description={getErrorDescription(educationLevelsQuery.error)}
        />
      ) : educationLevelsQuery.data.length === 0 ? (
        <EmptyState
          title="No education levels yet"
          description="Add the first education level for this world."
        />
      ) : (
        <EducationLevelsTable
          canEdit={canEdit}
          educationLevels={educationLevelsQuery.data}
          queryClient={queryClient}
          worldId={worldId}
        />
      )}

      {canEdit && showForm ? (
        <CreateEducationLevelForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateEducationLevelInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, "Failed to create education level.");
              },
              onSuccess: () => {
                notifyMutationSuccess("Education level created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
