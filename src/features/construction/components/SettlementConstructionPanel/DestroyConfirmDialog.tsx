import { type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { MutationConfirmDialog } from "@/components/shared/MutationConfirmDialog";

import { hardDeleteConstructionProjectMutationOptions } from "../../mutations/hardDeleteConstructionProjectMutations";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function DestroyConfirmDialog({
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
      title={`Permanently destroy ${project.blueprintName}?`}
      description={
        <>
          This will permanently delete the cancelled construction of{" "}
          <span className="font-medium text-foreground">
            {project.blueprintName}
          </span>{" "}
          (Tier {project.tierNumber}). This cannot be undone, and no resources
          will be refunded.
        </>
      }
      confirmLabel="Destroy permanently"
      cancelLabel="Keep"
      mutationOptions={hardDeleteConstructionProjectMutationOptions({
        queryClient,
        settlementId,
        worldId,
      })}
      input={{ projectId: project.id }}
      successMessage="Construction project destroyed."
      errorFallback="Failed to destroy construction project."
    />
  );
}
