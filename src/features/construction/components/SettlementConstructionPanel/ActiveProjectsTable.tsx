import { useQuery, type QueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  citizenAggregateStatsForSettlementQueryOptions,
  settlementConstructionProjectCountsQueryOptions,
} from "@/features/citizens";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import type { TurnTransitionLogEntry } from "@/features/turns";

import { ProjectRow } from "./ProjectRow";
import { ACTIVE_STATUSES } from "./utils/ConstructionQueueUtils";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function ActiveProjectsTable({
  allProjects,
  canAct,
  logEntries,
  onQueueClick,
  queryClient,
  settlementId,
  worldId,
}: {
  readonly allProjects: readonly ConstructionProject[];
  readonly canAct: boolean;
  readonly logEntries: readonly TurnTransitionLogEntry[];
  readonly onQueueClick: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const activeProjects = allProjects.filter((p) =>
    (ACTIVE_STATUSES as readonly string[]).includes(p.status),
  );

  const projectCountsQuery = useQuery(
    settlementConstructionProjectCountsQueryOptions(settlementId),
  );
  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  if (activeProjects.length === 0) {
    return (
      <EmptyState
        title="No active projects"
        description={
          canAct
            ? "Queue a construction project to get started."
            : "No construction projects are currently queued."
        }
        action={
          canAct ? (
            <Button size="sm" variant="outline" onClick={onQueueClick}>
              <Plus aria-hidden="true" />
              Start construction
            </Button>
          ) : undefined
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
  const totalConstructionWorkers =
    aggregateQuery.data?.assignmentTypeBreakdown.construction_project ?? 0;
  const allocatedWorkerCount = (projectCountsQuery.data ?? []).reduce(
    (sum, c) => sum + c.currentCount,
    0,
  );
  const unallocatedPoolCount = Math.max(
    0,
    totalConstructionWorkers - allocatedWorkerCount,
  );
  const resourceNames = new Map(
    (resourcesQuery.data ?? []).map((r) => [r.id, r.name]),
  );

  return (
    <>
      <div className="mb-3 flex items-baseline gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
        <span className="text-2xl font-mono font-semibold tabular-nums">
          {unallocatedPoolCount}
        </span>
        <span className="text-sm text-muted-foreground">
          unassigned construction worker
          {unallocatedPoolCount === 1 ? "" : "s"} — fills projects in queue
          order
        </span>
      </div>
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow className="text-muted-foreground">
            <TableHead scope="col">Blueprint</TableHead>
            <TableHead scope="col">Tier</TableHead>
            <TableHead scope="col">Status</TableHead>
            <TableHead scope="col">Workers (this turn)</TableHead>
            <TableHead scope="col">Assigned</TableHead>
            <TableHead scope="col">Progress</TableHead>
            <TableHead scope="col">Resources required</TableHead>
            <TableHead scope="col">Per-turn consumption</TableHead>
            {canAct ? (
              <>
                <TableHead scope="col">Set workers</TableHead>
                <TableHead className="w-36" scope="col" aria-label="Actions" />
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {activeProjects.map((project, index) => (
            <ProjectRow
              key={project.id}
              assignedWorkerCount={assignedByProject.get(project.id) ?? 0}
              canAct={canAct}
              isFirst={index === 0}
              isLast={index === activeProjects.length - 1}
              logEntries={logEntries}
              project={project}
              projects={activeProjects}
              queryClient={queryClient}
              resourceNames={resourceNames}
              settlementId={settlementId}
              unassignedNpcCount={unassignedNpcCount}
              worldId={worldId}
            />
          ))}
        </TableBody>
      </Table>
    </>
  );
}
