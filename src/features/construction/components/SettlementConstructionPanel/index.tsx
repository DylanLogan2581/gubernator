import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useSettlementTransitionOutcome,
  type TurnTransitionLogEntry,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";

import { constructionProjectsBySettlementQueryOptions } from "../../queries/constructionProjectsQueries";

import { ActiveProjectsTable } from "./ActiveProjectsTable";
import { CancelledProjectsTable } from "./CancelledProjectsTable";
import { CreateProjectDialog } from "./CreateProjectDialog";

import type { ConstructionProject } from "../../types/constructionProjectTypes";

type SettlementConstructionPanelProps = {
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

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
    <Card
      aria-labelledby="settlement-construction-heading"
      className="grid gap-3"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
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

      <CardContent>
        {projectsQuery.isPending ? (
          <TableSkeleton columnCount={5} rowCount={5} />
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
      </CardContent>
    </Card>
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
  if (showCancelled) {
    return (
      <CancelledProjectsTable
        allProjects={allProjects}
        canAct={canAct}
        queryClient={queryClient}
        settlementId={settlementId}
      />
    );
  }

  return (
    <ActiveProjectsTable
      allProjects={allProjects}
      canAct={canAct}
      logEntries={logEntries}
      queryClient={queryClient}
      settlementId={settlementId}
    />
  );
}
