import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { cancelConstructionProjectMutationOptions } from "../../mutations/cancelConstructionProjectMutations";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function CancelConfirmDialog({
  onClose,
  project,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly onClose: () => void;
  readonly project: ConstructionProject;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  return (
    <MutationConfirmDialog
      onClose={onClose}
      title={`Cancel ${project.blueprintName}?`}
      description={
        <>
          This will cancel the construction of{" "}
          <span className="font-medium text-foreground">
            {project.blueprintName}
          </span>{" "}
          (Tier {project.tierNumber}). Any assigned citizens will be unassigned.
        </>
      }
      confirmLabel="Cancel project"
      cancelLabel="Keep"
      mutationOptions={cancelConstructionProjectMutationOptions({
        queryClient,
        settlementId,
        worldId,
      })}
      input={{ projectId: project.id }}
      successMessage={(result) =>
        result.unassignedCitizenCount > 0
          ? {
              message: "Construction project cancelled.",
              description: `${result.unassignedCitizenCount.toString()} citizen(s) unassigned.`,
            }
          : "Construction project cancelled."
      }
      errorFallback="Failed to cancel construction project."
    />
  );
}
