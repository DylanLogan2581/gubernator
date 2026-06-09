import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useId, useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  citizenAggregateStatsForSettlementQueryOptions,
  settlementConstructionProjectCountsQueryOptions,
} from "@/features/citizens";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import {
  useSettlementTransitionOutcome,
  type TurnTransitionLogEntry,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { parseConstructionPausedPayload } from "@/shared/simulation";

import { cancelConstructionProjectMutationOptions } from "../mutations/cancelConstructionProjectMutations";
import { createConstructionProjectMutationOptions } from "../mutations/createConstructionProjectMutations";
import { hardDeleteConstructionProjectMutationOptions } from "../mutations/hardDeleteConstructionProjectMutations";
import { reorderConstructionProjectsMutationOptions } from "../mutations/reorderConstructionProjectsMutations";
import { resumeConstructionProjectMutationOptions } from "../mutations/resumeConstructionProjectMutations";
import { setConstructionProjectWorkersMutationOptions } from "../mutations/setConstructionProjectWorkersMutations";
import {
  blueprintsByWorldQueryOptions,
  tiersByBlueprintQueryOptions,
} from "../queries/buildingsQueries";
import { constructionProjectsBySettlementQueryOptions } from "../queries/constructionProjectsQueries";
import { settlementBuildingsBySettlementQueryOptions } from "../queries/settlementBuildingsQueries";

import type {
  BuildingBlueprint,
  BuildingBlueprintTier,
} from "../types/buildingTypes";
import type {
  ConstructionProject,
  ConstructionProjectStatus,
} from "../types/constructionProjectTypes";
import type { SettlementBuilding } from "../types/settlementBuildingTypes";

type SettlementConstructionPanelProps = {
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

type ProjectLogData = {
  readonly pauseReason: string | null;
  readonly workers: number;
};

const CONSTRUCTION_LOG_CATEGORIES = new Set([
  "construction.completed",
  "construction.paused",
  "construction.progress",
]);

function getProjectLogData(
  projectId: string,
  logEntries: readonly TurnTransitionLogEntry[],
): ProjectLogData | null {
  for (const entry of logEntries) {
    if (!CONSTRUCTION_LOG_CATEGORIES.has(entry.logCategory)) continue;
    const parsed = parseConstructionPausedPayload(entry.payloadJsonb);
    if (parsed === null || parsed.projectId !== projectId) continue;
    return {
      pauseReason:
        entry.logCategory === "construction.paused"
          ? "Insufficient resources"
          : null,
      workers: parsed.workers,
    };
  }
  return null;
}

const ACTIVE_STATUSES: readonly ConstructionProjectStatus[] = [
  "queued",
  "in_progress",
  "paused",
];

export function SettlementConstructionPanel({
  canManageSettlement,
  isArchived,
  settlementId,
  worldId,
}: SettlementConstructionPanelProps): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const projectsQuery = useQuery(
    constructionProjectsBySettlementQueryOptions(settlementId),
  );
  const latestOutcome = useSettlementTransitionOutcome(settlementId);
  const queryClient = useQueryClient();
  const canAct = canManageSettlement && !isArchived;

  return (
    <section
      aria-labelledby="settlement-construction-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="settlement-construction-heading"
          className="text-base font-medium"
        >
          Construction Queue
        </h2>
        <div className="flex items-center gap-2">
          {canAct && !showCancelled ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
              Start construction
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showCancelled ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={showCancelled ? "Hide cancelled" : "Show cancelled"}
            aria-pressed={showCancelled}
            title={showCancelled ? "Hide cancelled" : "Show cancelled"}
            onClick={() => {
              setShowCancelled((v) => !v);
            }}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      {projectsQuery.isPending ? (
        <LoadingState label="Loading construction queue…" />
      ) : projectsQuery.isError ? (
        <ErrorState
          title="Construction queue could not be loaded"
          description={getErrorDescription(projectsQuery.error)}
        />
      ) : (
        <QueueContent
          allProjects={projectsQuery.data}
          canAct={canAct}
          logEntries={latestOutcome?.logEntries ?? []}
          queryClient={queryClient}
          settlementId={settlementId}
          showCancelled={showCancelled}
        />
      )}

      {createOpen ? (
        <CreateProjectDialog
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setCreateOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function QueueContent({
  allProjects,
  canAct,
  logEntries,
  queryClient,
  settlementId,
  showCancelled,
}: {
  readonly allProjects: readonly ConstructionProject[];
  readonly canAct: boolean;
  readonly logEntries: readonly TurnTransitionLogEntry[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly showCancelled: boolean;
}): JSX.Element {
  const activeProjects = allProjects.filter((p) =>
    (ACTIVE_STATUSES as readonly string[]).includes(p.status),
  );

  const cancelledProjects = allProjects.filter((p) => p.status === "cancelled");

  const projectsToShow = showCancelled ? cancelledProjects : activeProjects;

  const projectCountsQuery = useQuery(
    settlementConstructionProjectCountsQueryOptions(settlementId),
  );
  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );

  if (projectsToShow.length === 0) {
    return (
      <EmptyState
        title={showCancelled ? "No cancelled projects" : "No active projects"}
        description={
          showCancelled
            ? "No construction projects have been cancelled."
            : "No construction projects are currently queued."
        }
      />
    );
  }

  const assignedByProject = new Map(
    (projectCountsQuery.data ?? []).map((c) => [
      c.constructionProjectId,
      c.currentCount,
    ]),
  );
  const unassignedNpcCount = aggregateQuery.data?.unassignedNpcCount ?? 0;

  if (showCancelled) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 font-medium" scope="col">
              Blueprint
            </th>
            <th className="pb-2 font-medium" scope="col">
              Tier
            </th>
            <th className="pb-2 font-medium" scope="col">
              Progress
            </th>
            {canAct ? (
              <th className="w-64 pb-2" scope="col" aria-label="Actions" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {cancelledProjects
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((project) => (
              <CancelledProjectRow
                key={project.id}
                canAct={canAct}
                project={project}
                queryClient={queryClient}
                settlementId={settlementId}
              />
            ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="pb-2 font-medium" scope="col">
            Blueprint
          </th>
          <th className="pb-2 font-medium" scope="col">
            Tier
          </th>
          <th className="pb-2 font-medium" scope="col">
            Status
          </th>
          <th className="pb-2 font-medium" scope="col">
            Workers (this turn)
          </th>
          <th className="pb-2 font-medium" scope="col">
            Assigned
          </th>
          <th className="pb-2 font-medium" scope="col">
            Progress
          </th>
          {canAct ? (
            <>
              <th className="pb-2 font-medium" scope="col">
                Set workers
              </th>
              <th className="w-36 pb-2" scope="col" aria-label="Actions" />
            </>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {activeProjects.map((project, index) => (
          <ProjectRow
            key={project.id}
            assignedWorkerCount={assignedByProject.get(project.id) ?? 0}
            canAct={canAct}
            isFirst={index === 0}
            isLast={index === activeProjects.length - 1}
            logData={getProjectLogData(project.id, logEntries)}
            project={project}
            projects={activeProjects}
            queryClient={queryClient}
            settlementId={settlementId}
            unassignedNpcCount={unassignedNpcCount}
          />
        ))}
      </tbody>
    </table>
  );
}

function statusBadgeVariant(
  status: ConstructionProjectStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "in_progress":
      return "default";
    case "queued":
      return "outline";
    case "paused":
      return "secondary";
    case "complete":
      return "default";
    case "cancelled":
      return "destructive";
  }
}

function statusBadgeLabel(status: ConstructionProjectStatus): string {
  switch (status) {
    case "in_progress":
      return "in progress";
    case "queued":
      return "queued";
    case "paused":
      return "paused";
    case "complete":
      return "complete";
    case "cancelled":
      return "cancelled";
  }
}

function ProjectRow({
  assignedWorkerCount,
  canAct,
  isFirst,
  isLast,
  logData,
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
  readonly logData: ProjectLogData | null;
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

  function buildPositions(
    movedId: string,
    direction: "up" | "down",
  ): Array<{ projectId: string; position: number }> {
    const items = [...projects];
    const idx = items.findIndex((p) => p.id === movedId);
    if (idx === -1) return [];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return [];
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    return items.map((p, i) => ({ position: i + 1, projectId: p.id }));
  }

  async function handleMove(direction: "up" | "down"): Promise<void> {
    const positions = buildPositions(project.id, direction);
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
      <tr className="border-b border-border last:border-0">
        <td className="py-2 pr-4">{project.blueprintName}</td>
        <td className="py-2 pr-4">Tier {project.tierNumber}</td>
        <td className="py-2 pr-4">
          {pauseReason !== null ? (
            <span title={pauseReason}>{statusBadge}</span>
          ) : (
            statusBadge
          )}
        </td>
        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
          {logData !== null ? logData.workers.toString() : "—"}
        </td>
        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
          {assignedWorkerCount}
        </td>
        <td className="py-2 pr-4 text-muted-foreground">
          {project.progressWorkerTurns} / {project.workerTurnsRequired}{" "}
          worker-turns
        </td>
        {canAct ? (
          <>
            <td className="py-2 pr-4">
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
            </td>
            <td className="w-36 py-2">
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
            </td>
          </>
        ) : null}
      </tr>
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

function CancelConfirmDialog({
  onClose,
  project,
  queryClient,
  settlementId,
}: {
  readonly onClose: () => void;
  readonly project: ConstructionProject;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const cancelMutation = useMutation(
    cancelConstructionProjectMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      const result = await cancelMutation.mutateAsync({
        projectId: project.id,
      });
      if (result.unassignedCitizenCount > 0) {
        notifyMutationSuccess("Construction project cancelled.", {
          description: `${result.unassignedCitizenCount} citizen(s) unassigned.`,
        });
      } else {
        notifyMutationSuccess("Construction project cancelled.");
      }
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to cancel construction project.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {project.blueprintName}?</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will cancel the construction of{" "}
          <span className="font-medium text-foreground">
            {project.blueprintName}
          </span>{" "}
          (Tier {project.tierNumber}). Any assigned citizens will be unassigned.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={cancelMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Keep
          </Button>
          <Button
            disabled={cancelMutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Cancel project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelledProjectRow({
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

function DestroyConfirmDialog({
  onClose,
  project,
  queryClient,
  settlementId,
}: {
  readonly onClose: () => void;
  readonly project: ConstructionProject;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const destroyMutation = useMutation(
    hardDeleteConstructionProjectMutationOptions({ queryClient, settlementId }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await destroyMutation.mutateAsync({
        projectId: project.id,
      });
      notifyMutationSuccess("Construction project destroyed.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to destroy construction project.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Permanently destroy {project.blueprintName}?
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This will permanently delete the cancelled construction of{" "}
          <span className="font-medium text-foreground">
            {project.blueprintName}
          </span>{" "}
          (Tier {project.tierNumber}). This cannot be undone, and no resources
          will be refunded.
        </DialogDescription>
        <DialogFooter>
          <Button
            disabled={destroyMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Keep
          </Button>
          <Button
            disabled={destroyMutation.isPending}
            type="button"
            variant="destructive"
            onClick={() => {
              void handleConfirm();
            }}
          >
            Destroy permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getCapOverflowError(
  blueprint: BuildingBlueprint | undefined,
  blueprintId: string,
  projects: readonly ConstructionProject[],
  buildings: readonly SettlementBuilding[],
): string | null {
  if (blueprintId === "" || blueprint === undefined) return null;
  const max = blueprint.maxInstancesPerSettlement;
  if (max === null) return null;

  const activeBuildings = buildings.filter(
    (b) => b.buildingBlueprintId === blueprintId && b.state === "active",
  ).length;
  const activeProjects = projects.filter(
    (p) =>
      p.buildingBlueprintId === blueprintId &&
      (ACTIVE_STATUSES as readonly string[]).includes(p.status),
  ).length;

  if (activeBuildings + activeProjects >= max) {
    return `This settlement already has ${activeBuildings + activeProjects} of ${max} allowed instance(s) of this blueprint.`;
  }
  return null;
}

function CreateProjectDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const blueprintSelectId = useId();
  const tierSelectId = useId();

  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");
  const [selectedTierId, setSelectedTierId] = useState("");

  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));
  const projectsQuery = useQuery(
    constructionProjectsBySettlementQueryOptions(settlementId),
  );
  const buildingsQuery = useQuery(
    settlementBuildingsBySettlementQueryOptions(settlementId),
  );
  const tiersQuery = useQuery({
    ...tiersByBlueprintQueryOptions(selectedBlueprintId),
    enabled: selectedBlueprintId !== "",
  });
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const resourceNames = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
  );

  const createMutation = useMutation(
    createConstructionProjectMutationOptions({ queryClient }),
  );

  const availableBlueprints: readonly BuildingBlueprint[] =
    blueprintsQuery.data?.filter((b) => !b.isTrashed) ?? [];

  const selectedBlueprint: BuildingBlueprint | undefined =
    availableBlueprints.find((b) => b.id === selectedBlueprintId);

  const selectedTier: BuildingBlueprintTier | undefined = tiersQuery.data?.find(
    (t) => t.id === selectedTierId,
  );

  const capOverflowError = getCapOverflowError(
    selectedBlueprint,
    selectedBlueprintId,
    projectsQuery.data ?? [],
    buildingsQuery.data ?? [],
  );

  async function handleCreate(): Promise<void> {
    if (selectedBlueprintId === "" || selectedTierId === "") return;
    try {
      await createMutation.mutateAsync({
        blueprintId: selectedBlueprintId,
        settlementId,
        targetTierId: selectedTierId,
      });
      notifyMutationSuccess("Construction project started.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to start construction project.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start construction</DialogTitle>
          <DialogDescription>
            Choose the blueprint and tier for the new construction project.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor={blueprintSelectId}>
              Blueprint
            </label>
            {blueprintsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">
                Loading blueprints…
              </p>
            ) : blueprintsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorDescription(blueprintsQuery.error)}
              </p>
            ) : (
              <NativeSelect
                aria-invalid={capOverflowError !== null ? true : undefined}
                className="w-full"
                id={blueprintSelectId}
                value={selectedBlueprintId}
                onChange={(e) => {
                  setSelectedBlueprintId(e.target.value);
                  setSelectedTierId("");
                }}
              >
                <option value="">Select a blueprint…</option>
                {availableBlueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            {capOverflowError !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {capOverflowError}
              </p>
            ) : null}
          </div>

          {selectedBlueprintId !== "" ? (
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor={tierSelectId}>
                Tier
              </label>
              {tiersQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading tiers…</p>
              ) : tiersQuery.isError ? (
                <p className="text-sm text-destructive">
                  {getErrorDescription(tiersQuery.error)}
                </p>
              ) : (
                <NativeSelect
                  className="w-full"
                  id={tierSelectId}
                  value={selectedTierId}
                  onChange={(e) => {
                    setSelectedTierId(e.target.value);
                  }}
                >
                  <option value="">Select a tier…</option>
                  {(tiersQuery.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      Tier {t.tierNumber}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>
          ) : null}

          {selectedTier !== undefined &&
          selectedTier.constructionCostsJson.length > 0 ? (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Construction cost</p>
              <ul className="grid gap-0.5">
                {selectedTier.constructionCostsJson.map((cost) => (
                  <li
                    key={cost.resourceId}
                    className="text-sm text-muted-foreground"
                  >
                    {resourceNames.get(cost.resourceId) ?? cost.resourceId}:{" "}
                    {cost.amount}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={createMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={
              createMutation.isPending ||
              selectedBlueprintId === "" ||
              selectedTierId === "" ||
              capOverflowError !== null
            }
            type="button"
            onClick={() => {
              void handleCreate();
            }}
          >
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
