import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    <Table className="w-full text-sm">
      <TableHeader>
        <TableRow className="text-muted-foreground">
          <TableHead scope="col">Blueprint</TableHead>
          <TableHead scope="col">Tier</TableHead>
          <TableHead scope="col">Progress</TableHead>
          {canAct ? (
            <TableHead className="w-64" scope="col" aria-label="Actions" />
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
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
      </TableBody>
    </Table>
  );
}
