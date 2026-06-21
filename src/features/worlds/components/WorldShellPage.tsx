import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Settings2,
} from "lucide-react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  currentAccessContextQueryOptions,
  useActivePlayerCharacter,
} from "@/features/permissions";
import {
  SettlementReadinessListPanel,
  settlementReadinessSummaryQueryOptions,
} from "@/features/settlements";
import { EndTurnControl, TurnTransitionOutcomePanel } from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "../queries/worldQueries";

import { WorldReportsSection } from "./WorldReportsSection";

import type { JSX, ReactNode } from "react";

type WorldShellPageProps = {
  readonly worldId: string;
};

export function WorldShellPage({ worldId }: WorldShellPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <WorldShellFrame>
        <LoadingState label="Loading world access…" />
      </WorldShellFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <WorldShellFrame>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </WorldShellFrame>
    );
  }

  return (
    <WorldShellContent
      accessContext={accessContextQuery.data}
      worldId={worldId}
    />
  );
}

function WorldShellContent({
  accessContext,
  worldId,
}: {
  readonly accessContext: Parameters<typeof worldRouteAccessQueryOptions>[1];
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );
  const { activeCharacter } = useActivePlayerCharacter();
  const effectiveCanAdmin =
    (worldQuery.data?.canAdmin ?? false) && activeCharacter === null;
  // Prefetch settlement readiness summary for SettlementReadinessListPanel
  void useQuery(settlementReadinessSummaryQueryOptions(worldId));

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <WorldShellFrame>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </WorldShellFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <WorldShellFrame>
        <LoadingState label="Loading world…" />
      </WorldShellFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <WorldShellFrame>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </WorldShellFrame>
      );
    }

    return (
      <WorldShellFrame>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </WorldShellFrame>
    );
  }

  return (
    <WorldShellFrame>
      <section
        aria-labelledby="world-shell-title"
        className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="world-shell-title"
                className="text-2xl font-semibold tracking-normal"
              >
                {worldQuery.data.header.name}
              </h1>
              {activeCharacter !== null ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-auto text-xs"
                >
                  <Link
                    to="/worlds/$worldId/citizens/$citizenId"
                    params={{ citizenId: activeCharacter.id, worldId }}
                  >
                    My character
                  </Link>
                </Button>
              ) : null}
            </div>
            <dl className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Planning turn</dt>
                <dd>{worldQuery.data.header.planningTurnNumber}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">In-world date</dt>
                <dd>{worldQuery.data.header.inWorldDateLabel}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Status</dt>
                <dd className="capitalize">{worldQuery.data.header.status}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Visibility</dt>
                <dd className="capitalize">
                  {worldQuery.data.header.visibility}
                </dd>
              </div>
            </dl>
          </div>
          {worldQuery.data.header.isArchived ? (
            <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
              <Archive className="size-3" aria-hidden="true" />
              Read-only archive
            </span>
          ) : null}
        </div>

        {worldQuery.data.header.isArchived ? (
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            This world is archived and available for review.
          </p>
        ) : null}
      </section>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/worlds/$worldId/events"
          params={{ worldId }}
          className="flex flex-col gap-3 rounded-md border border-border bg-card p-6 text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="text-xl font-semibold">Events</h2>
            </div>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            active and scheduled world events
          </p>
        </Link>
        {effectiveCanAdmin ? (
          <Link
            to="/worlds/$worldId/configuration"
            params={{ worldId }}
            search={{ tab: "resources" }}
            className="flex flex-col gap-3 rounded-md border border-border bg-card p-6 text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2
                  className="size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2 className="text-xl font-semibold">Configuration</h2>
              </div>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              resources, jobs, buildings…
            </p>
          </Link>
        ) : null}
      </div>
      <EndTurnControl
        canAdmin={effectiveCanAdmin}
        currentDateLabel={worldQuery.data.header.inWorldDateLabel}
        currentTurnNumber={worldQuery.data.header.currentTurnNumber}
        isArchived={worldQuery.data.header.isArchived}
        nextDateLabel={worldQuery.data.header.nextInWorldDateLabel}
        nextTurnNumber={worldQuery.data.header.nextTurnNumber}
        worldId={worldId}
      />
      <TurnTransitionOutcomePanel scope="world" id={worldId} />
      <SettlementReadinessListPanel
        accessContext={accessContext}
        canAdmin={effectiveCanAdmin}
        canManage={effectiveCanAdmin}
        isArchived={worldQuery.data.header.isArchived}
        worldId={worldId}
      />
      {effectiveCanAdmin ? (
        <WorldReportsSection
          currentTurnNumber={worldQuery.data.header.currentTurnNumber}
          worldId={worldId}
        />
      ) : null}
    </WorldShellFrame>
  );
}

function WorldShellFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds">
          <ArrowLeft aria-hidden="true" />
          Back to worlds
        </Link>
      </Button>
      {children}
    </div>
  );
}
