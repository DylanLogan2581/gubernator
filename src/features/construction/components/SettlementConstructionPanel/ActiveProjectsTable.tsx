import { useQuery, type QueryClient } from "@tanstack/react-query";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
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
            logEntries={logEntries}
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
