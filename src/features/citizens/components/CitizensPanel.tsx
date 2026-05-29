import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { getErrorDescription } from "@/lib/errorUtils";

import { assignmentsInSettlementQueryOptions } from "../queries/citizenAssignmentsQueries";
import {
  citizenAggregateStatsForSettlementQueryOptions,
  citizensInSettlementQueryOptions,
} from "../queries/citizensQueries";

import { CreateNpcDialog } from "./citizenCreation/CreateNpcDialog";
import { CreatePlayerCharacterDialog } from "./citizenCreation/CreatePlayerCharacterDialog";

import type { CitizenAssignment } from "../types/citizenAssignmentTypes";
import type {
  Citizen,
  CitizenAggregateStats,
  CitizenAssignmentType,
} from "../types/citizenTypes";

type CitizensPanelProps = {
  readonly canAdmin: boolean;
  readonly incestPreventionDepth: number;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
};

const PAGE_SIZE = 25;

export function CitizensPanel({
  canAdmin,
  incestPreventionDepth,
  isArchived,
  settlementId,
  worldId,
}: CitizensPanelProps): JSX.Element {
  return (
    <section
      aria-labelledby="citizens-panel-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 id="citizens-panel-heading" className="text-base font-medium">
            Citizens
          </h2>
          <p className="text-sm text-muted-foreground">
            {canAdmin
              ? "Individual citizens in this settlement."
              : "Population summary for this settlement."}
          </p>
        </div>
        {canAdmin ? (
          <CitizensCreateActions
            incestPreventionDepth={incestPreventionDepth}
            isArchived={isArchived}
            settlementId={settlementId}
            worldId={worldId}
          />
        ) : null}
      </div>

      {canAdmin ? (
        <CitizensAdminList settlementId={settlementId} worldId={worldId} />
      ) : (
        <CitizensAggregateView settlementId={settlementId} />
      )}
    </section>
  );
}

type CitizensCreateMode = "npc" | "player_character" | null;

function CitizensCreateActions({
  incestPreventionDepth,
  isArchived,
  settlementId,
  worldId,
}: {
  readonly incestPreventionDepth: number;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CitizensCreateMode>(null);

  const disabledReason = isArchived
    ? "Creating citizens is disabled because this world is archived."
    : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isArchived}
          title={disabledReason}
          aria-label="Create NPC"
          onClick={() => setMode("npc")}
        >
          <UserPlus aria-hidden="true" />
          Create NPC
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isArchived}
          title={disabledReason}
          aria-label="Create player character"
          onClick={() => setMode("player_character")}
        >
          <UserPlus aria-hidden="true" />
          Create player character
        </Button>
      </div>
      {mode === "npc" ? (
        <CreateNpcDialog
          incestPreventionDepth={incestPreventionDepth}
          onClose={() => setMode(null)}
          onCreated={() => undefined}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}
      {mode === "player_character" ? (
        <CreatePlayerCharacterDialog
          incestPreventionDepth={incestPreventionDepth}
          onClose={() => setMode(null)}
          onCreated={() => undefined}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}
    </>
  );
}

function CitizensAdminList({
  settlementId,
  worldId,
}: {
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const [includeDead, setIncludeDead] = useState(false);
  const [page, setPage] = useState(0);

  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );
  const assignmentsQuery = useQuery(
    assignmentsInSettlementQueryOptions(settlementId),
  );

  const assignmentByCitizenId = useMemo(() => {
    if (assignmentsQuery.data === undefined) {
      return new Map<string, CitizenAssignment>();
    }
    return new Map(
      assignmentsQuery.data.map((row) => [row.citizenId, row] as const),
    );
  }, [assignmentsQuery.data]);

  const filtered = useMemo(() => {
    if (citizensQuery.data === undefined) {
      return [];
    }
    return includeDead
      ? citizensQuery.data
      : citizensQuery.data.filter((citizen) => citizen.status === "alive");
  }, [citizensQuery.data, includeDead]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (citizensQuery.isPending) {
    return <LoadingState label="Loading citizens…" />;
  }

  if (citizensQuery.isError) {
    return (
      <ErrorState
        title="Citizens could not be loaded"
        description={getErrorDescription(citizensQuery.error)}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeDead}
            onChange={(event) => {
              setIncludeDead(event.currentTarget.checked);
              setPage(0);
            }}
            className="size-4"
          />
          Include deceased
        </label>
        <p className="text-xs text-muted-foreground" role="status">
          {filtered.length === 0
            ? "0 citizens"
            : `Showing ${pageStart + 1}–${pageStart + pageItems.length} of ${filtered.length}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={includeDead ? "No citizens yet" : "No living citizens"}
          description={
            includeDead
              ? "Citizens added to this settlement will appear here."
              : "Toggle “Include deceased” to see citizens who have died."
          }
        />
      ) : (
        <>
          <ul aria-label="Citizens" className="grid gap-2">
            {pageItems.map((citizen) => (
              <CitizenRow
                key={citizen.id}
                assignment={assignmentByCitizenId.get(citizen.id) ?? null}
                citizen={citizen}
                worldId={worldId}
              />
            ))}
          </ul>
          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <p className="text-xs text-muted-foreground">
                Page {safePage + 1} of {pageCount}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setPage((current) => Math.min(pageCount - 1, current + 1))
                }
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function CitizenRow({
  assignment,
  citizen,
  worldId,
}: {
  readonly assignment: CitizenAssignment | null;
  readonly citizen: Citizen;
  readonly worldId: string;
}): JSX.Element {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <Link
          to="/worlds/$worldId/citizens/$citizenId"
          params={{ citizenId: citizen.id, worldId }}
          className="truncate text-sm font-medium underline-offset-4 hover:underline"
        >
          {citizen.name}
        </Link>
        {citizen.sex === null ? null : (
          <span className="text-xs text-muted-foreground">{citizen.sex}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip label={citizenTypeLabel(citizen.citizenType)} />
        <Chip
          label={citizen.status === "alive" ? "Alive" : "Deceased"}
          tone={citizen.status === "alive" ? "default" : "muted"}
        />
        <Chip
          label={
            assignment === null
              ? "Unassigned"
              : assignmentTypeLabel(assignment.assignmentType)
          }
          tone={assignment === null ? "muted" : "default"}
        />
      </div>
    </li>
  );
}

// The aggregate view enforces the "DB access, UI aggregates" policy: Nation
// Managers and Settlement Managers have RLS-level read access to individual
// citizen rows, but this UI never renders rows for non-admins. If a future
// feature needs per-citizen detail for those roles, reuse the existing
// citizensInSettlementQueryOptions query — no schema or RLS change required.
function CitizensAggregateView({
  settlementId,
}: {
  readonly settlementId: string;
}): JSX.Element {
  const aggregateQuery = useQuery(
    citizenAggregateStatsForSettlementQueryOptions(settlementId),
  );

  if (aggregateQuery.isPending) {
    return <LoadingState label="Loading citizen summary…" />;
  }

  if (aggregateQuery.isError) {
    return (
      <ErrorState
        title="Citizen summary could not be loaded"
        description={getErrorDescription(aggregateQuery.error)}
      />
    );
  }

  return <CitizensAggregateContent stats={aggregateQuery.data} />;
}

function CitizensAggregateContent({
  stats,
}: {
  readonly stats: CitizenAggregateStats;
}): JSX.Element {
  const aliveTotal = stats.statusBreakdown.alive;

  if (stats.total === 0) {
    return (
      <EmptyState
        title="No citizens yet"
        description="Counts appear here once citizens are added to this settlement."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Stat label="Living citizens" value={aliveTotal} />
        <Stat label="NPCs" value={stats.typeBreakdown.npc} />
        <Stat
          label="Player characters"
          value={stats.typeBreakdown.player_character}
        />
      </dl>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Assignments</p>
        <ul aria-label="Assignment breakdown" className="grid gap-1.5">
          {ASSIGNMENT_BREAKDOWN_ORDER.map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              <span className="text-muted-foreground">
                {assignmentBreakdownLabel(key)}
              </span>
              <span className="font-medium tabular-nums">
                {stats.assignmentTypeBreakdown[key]}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Chip({
  label,
  tone = "default",
}: {
  readonly label: string;
  readonly tone?: "default" | "muted";
}): JSX.Element {
  const className =
    tone === "muted"
      ? "inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      : "inline-flex items-center rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground";
  return <span className={className}>{label}</span>;
}

const ASSIGNMENT_BREAKDOWN_ORDER: ReadonlyArray<
  CitizenAssignmentType | "unassigned"
> = [
  "standard_job",
  "construction_project",
  "deposit",
  "husbandry",
  "culling",
  "trade_route",
  "unassigned",
];

function assignmentBreakdownLabel(
  key: CitizenAssignmentType | "unassigned",
): string {
  if (key === "unassigned") {
    return "Unassigned";
  }
  return assignmentTypeLabel(key);
}

function assignmentTypeLabel(type: CitizenAssignmentType): string {
  switch (type) {
    case "construction_project":
      return "Construction";
    case "culling":
      return "Culling";
    case "deposit":
      return "Deposit";
    case "husbandry":
      return "Husbandry";
    case "standard_job":
      return "Standard job";
    case "trade_route":
      return "Trade route";
  }
}

function citizenTypeLabel(type: Citizen["citizenType"]): string {
  return type === "npc" ? "NPC" : "Player character";
}
