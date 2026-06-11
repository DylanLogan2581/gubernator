import { useMutation, type QueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import type { TurnTransitionLogEntry } from "@/features/turns";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { reorderConstructionProjectsMutationOptions } from "../../mutations/reorderConstructionProjectsMutations";
import { setConstructionProjectWorkersMutationOptions } from "../../mutations/setConstructionProjectWorkersMutations";

import { CancelConfirmDialog } from "./CancelConfirmDialog";
import {
  buildPositions,
  getProjectLogData,
  statusBadgeLabel,
  statusBadgeVariant,
} from "./utils/ConstructionQueueUtils";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function ProjectRow({
  assignedWorkerCount,
  canAct,
  isFirst,
  isLast,
  logEntries,
  project,
  projects,
  queryClient,
  settlementId,
  unassignedNpcCount,
}: {
  readonly assignedWorkerCount: number;
  readonly canAct: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly logEntries: readonly TurnTransitionLogEntry[];
  readonly project: ConstructionProject;
  readonly projects: readonly ConstructionProject[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unassignedNpcCount: number;
}): JSX.Element {
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [localCount, setLocalCount] = useState(String(assignedWorkerCount));
  const reorderMutation = useMutation(
    reorderConstructionProjectsMutationOptions({ queryClient }),
  );
  const workersMutation = useMutation(
    setConstructionProjectWorkersMutationOptions({ queryClient }),
  );

  const logData = getProjectLogData(project.id, logEntries);

  async function handleMove(direction: "up" | "down"): Promise<void> {
    const positions = buildPositions(projects, project.id, direction);
    if (positions.length === 0) return;
    try {
      await reorderMutation.mutateAsync({ positions, settlementId });
    } catch (error) {
      notifyMutationError(error, "Failed to reorder construction projects.");
    }
  }

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== assignedWorkerCount;
  const isRaising = isValid && parsedCount > assignedWorkerCount;
  const applyDisabled =
    workersMutation.isPending ||
    !isDirty ||
    (isRaising && unassignedNpcCount === 0);

  async function handleApplyWorkers(): Promise<void> {
    if (!isValid) return;
    try {
      const result = await workersMutation.mutateAsync({
        projectId: project.id,
        settlementId,
        targetCount: parsedCount,
      });
      setLocalCount(String(result.after));
      notifyMutationSuccess("Worker assignment updated.");
    } catch (error) {
      notifyMutationError(error, "Failed to update worker assignment.");
    }
  }

  const pauseReason: string | null = logData?.pauseReason ?? null;

  const statusBadge = (
    <Badge
      aria-label={`Status: ${statusBadgeLabel(project.status)}`}
      variant={statusBadgeVariant(project.status)}
    >
      {statusBadgeLabel(project.status)}
    </Badge>
  );

  const applyButton = (
    <Button
      disabled={applyDisabled}
      size="sm"
      type="button"
      onClick={() => {
        void handleApplyWorkers();
      }}
    >
      Apply
    </Button>
  );

  return (
    <>
      <TableRow className="border-b border-border last:border-0">
        <TableCell className="py-2 pr-4">{project.blueprintName}</TableCell>
        <TableCell className="py-2 pr-4">Tier {project.tierNumber}</TableCell>
        <TableCell className="py-2 pr-4">
          {pauseReason !== null ? (
            <span title={pauseReason}>{statusBadge}</span>
          ) : (
            statusBadge
          )}
        </TableCell>
        <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground">
          {logData !== null ? logData.workers.toString() : "—"}
        </TableCell>
        <TableCell className="py-2 pr-4 tabular-nums text-muted-foreground">
          {assignedWorkerCount}
        </TableCell>
        <TableCell className="py-2 pr-4 text-muted-foreground">
          {project.progressWorkerTurns} / {project.workerTurnsRequired}{" "}
          worker-turns
        </TableCell>
        {canAct ? (
          <>
            <TableCell className="py-2 pr-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label={`Target workers for ${project.blueprintName}`}
                  className="w-20"
                  disabled={workersMutation.isPending}
                  inputMode="numeric"
                  min="0"
                  type="number"
                  value={localCount}
                  onChange={(e) => {
                    setLocalCount(e.currentTarget.value);
                  }}
                />
                {isRaising && unassignedNpcCount === 0 ? (
                  <span title="No unassigned NPCs available">
                    {applyButton}
                  </span>
                ) : (
                  applyButton
                )}
              </div>
            </TableCell>
            <TableCell className="w-36 py-2">
              <div className="flex items-center justify-end gap-1">
                <Button
                  aria-label={`Move ${project.blueprintName} up in queue`}
                  disabled={isFirst || reorderMutation.isPending}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void handleMove("up");
                  }}
                >
                  <ChevronUp aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Move ${project.blueprintName} down in queue`}
                  disabled={isLast || reorderMutation.isPending}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    void handleMove("down");
                  }}
                >
                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Cancel ${project.blueprintName}`}
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setConfirmCancelOpen(true);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </TableCell>
          </>
        ) : null}
      </TableRow>
      {confirmCancelOpen ? (
        <CancelConfirmDialog
          project={project}
          queryClient={queryClient}
          settlementId={settlementId}
          onClose={() => {
            setConfirmCancelOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
