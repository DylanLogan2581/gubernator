import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useId, useState, type JSX } from "react";

import { DialogShell } from "@/components/shared/DialogShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { cancelConstructionProjectMutationOptions } from "../mutations/cancelConstructionProjectMutations";
import { createConstructionProjectMutationOptions } from "../mutations/createConstructionProjectMutations";
import { reorderConstructionProjectsMutationOptions } from "../mutations/reorderConstructionProjectsMutations";
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
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

const ACTIVE_STATUSES: readonly ConstructionProjectStatus[] = [
  "queued",
  "in_progress",
  "paused",
];

export function SettlementConstructionPanel({
  canManage,
  isArchived,
  settlementId,
  worldId,
}: SettlementConstructionPanelProps): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const projectsQuery = useQuery(
    constructionProjectsBySettlementQueryOptions(settlementId),
  );
  const queryClient = useQueryClient();
  const canAct = canManage && !isArchived;

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
        {canAct ? (
          <Button
            size="sm"
            type="button"
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            Start construction
          </Button>
        ) : null}
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
          queryClient={queryClient}
          settlementId={settlementId}
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
  queryClient,
  settlementId,
}: {
  readonly allProjects: readonly ConstructionProject[];
  readonly canAct: boolean;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const activeProjects = allProjects.filter((p) =>
    (ACTIVE_STATUSES as readonly string[]).includes(p.status),
  );

  if (activeProjects.length === 0) {
    return (
      <EmptyState
        title="No active projects"
        description="No construction projects are currently queued."
      />
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
            Progress
          </th>
          {canAct ? (
            <th className="w-36 pb-2" scope="col" aria-label="Actions" />
          ) : null}
        </tr>
      </thead>
      <tbody>
        {activeProjects.map((project, index) => (
          <ProjectRow
            key={project.id}
            canAct={canAct}
            isFirst={index === 0}
            isLast={index === activeProjects.length - 1}
            project={project}
            projects={activeProjects}
            queryClient={queryClient}
            settlementId={settlementId}
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
  canAct,
  isFirst,
  isLast,
  project,
  projects,
  queryClient,
  settlementId,
}: {
  readonly canAct: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly project: ConstructionProject;
  readonly projects: readonly ConstructionProject[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): JSX.Element {
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const reorderMutation = useMutation(
    reorderConstructionProjectsMutationOptions({ queryClient }),
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

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="py-2 pr-4">{project.blueprintName}</td>
        <td className="py-2 pr-4">Tier {project.tierNumber}</td>
        <td className="py-2 pr-4">
          <Badge
            aria-label={`Status: ${statusBadgeLabel(project.status)}`}
            variant={statusBadgeVariant(project.status)}
          >
            {statusBadgeLabel(project.status)}
          </Badge>
        </td>
        <td className="py-2 pr-4 text-muted-foreground">
          {project.progressWorkerTurns} / {project.workerTurnsRequired}{" "}
          worker-turns
        </td>
        {canAct ? (
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
  const titleId = useId();
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
    <DialogShell>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-sm gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold">
            Cancel {project.blueprintName}?
          </h3>
          <Button
            aria-label="Close cancel dialog"
            disabled={cancelMutation.isPending}
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          This will cancel the construction of{" "}
          <span className="font-medium text-foreground">
            {project.blueprintName}
          </span>{" "}
          (Tier {project.tierNumber}). Any assigned citizens will be unassigned.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
        </div>
      </div>
    </DialogShell>
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
  const titleId = useId();
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
    <DialogShell>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold">
            Start construction
          </h3>
          <Button
            aria-label="Close start construction dialog"
            disabled={createMutation.isPending}
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

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

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
        </div>
      </div>
    </DialogShell>
  );
}
