import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { resumeConstructionProjectMutationOptions } from "../../mutations/resumeConstructionProjectMutations";

import { DestroyConfirmDialog } from "./DestroyConfirmDialog";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function CancelledProjectRow({
  canAct,
  project,
  queryClient,
  settlementId,
}: {
  readonly canAct: boolean;
  readonly project: ConstructionProject;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [showDestroyDialog, setShowDestroyDialog] = useState(false);
  const resumeMutation = useMutation(
    resumeConstructionProjectMutationOptions({ queryClient, settlementId }),
  );

  async function handleResume(): Promise<void> {
    try {
      await resumeMutation.mutateAsync({
        projectId: project.id,
      });
      notifyMutationSuccess("Construction project resumed.");
    } catch (error) {
      notifyMutationError(error, "Failed to resume construction project.");
    }
  }

  return (
    <>
      <tr className="border-b border-border">
        <td className="py-2">{project.blueprintName}</td>
        <td className="py-2">{project.tierNumber}</td>
        <td className="py-2">
          {project.progressWorkerTurns} / {project.workerTurnsRequired}
        </td>
        {canAct ? (
          <td className="flex items-center justify-end gap-2 py-2">
            <Button
              disabled={resumeMutation.isPending}
              onClick={() => {
                void handleResume();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Resume
            </Button>
            <Button
              disabled={resumeMutation.isPending}
              onClick={() => {
                setShowDestroyDialog(true);
              }}
              size="sm"
              type="button"
              variant="destructive"
            >
              Destroy
            </Button>
          </td>
        ) : null}
      </tr>
      {showDestroyDialog ? (
        <DestroyConfirmDialog
          onClose={() => {
            setShowDestroyDialog(false);
          }}
          project={project}
          queryClient={queryClient}
          settlementId={settlementId}
        />
      ) : null}
    </>
  );
}
