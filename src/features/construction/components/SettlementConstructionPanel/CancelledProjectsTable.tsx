import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";

import { CancelledProjectRow } from "./CancelledProjectRow";

import type { ConstructionProject } from "../../types/constructionProjectTypes";
import type { QueryClient } from "@tanstack/react-query";

export function CancelledProjectsTable({
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
  const cancelledProjects = allProjects.filter((p) => p.status === "cancelled");

  if (cancelledProjects.length === 0) {
    return (
      <EmptyState
        title="No cancelled projects"
        description="No construction projects have been cancelled."
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
