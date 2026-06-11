import { useQuery, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
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
import type { TurnTransitionLogEntry } from "@/features/turns";

import { ProjectRow } from "./ProjectRow";
import { ACTIVE_STATUSES } from "./utils/ConstructionQueueUtils";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

export function ActiveProjectsTable({
  allProjects,
  canAct,
  logEntries,
  queryClient,
  settlementId,
}: {
  readonly allProjects: readonly ConstructionProject[];
  readonly canAct: boolean;
  readonly logEntries: readonly TurnTransitionLogEntry[];
  readonly queryClient: QueryClient;
  readonly settlementId: string;
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

  if (activeProjects.length === 0) {
    return (
      <EmptyState
        title="No active projects"
        description="No construction projects are currently queued."
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

  return (
    <Table className="w-full text-sm">
      <TableHeader>
        <TableRow className="text-muted-foreground">
          <TableHead scope="col">Blueprint</TableHead>
          <TableHead scope="col">Tier</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Workers (this turn)</TableHead>
          <TableHead scope="col">Assigned</TableHead>
          <TableHead scope="col">Progress</TableHead>
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
            settlementId={settlementId}
            unassignedNpcCount={unassignedNpcCount}
          />
        ))}
      </TableBody>
    </Table>
  );
}
