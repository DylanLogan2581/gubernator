import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
} from "@/features/permissions";
import { SettlementReadinessListPanel } from "@/features/settlements";
import { EndTurnControl, TurnTransitionOutcomePanel } from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "../queries/worldQueries";

import { WorldActiveEventsFeed } from "./WorldActiveEventsFeed";
import { WorldDashboardHeroBanner } from "./WorldDashboardHeroBanner";
import { WorldDashboardStatTiles } from "./WorldDashboardStatTiles";
import { WorldReportsSection } from "./WorldReportsSection";
import { WorldTurnLogExcerpt } from "./WorldTurnLogExcerpt";

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
  const effectiveCanAdmin = useEffectiveCanAdmin(
    worldQuery.data?.canAdmin ?? false,
  );

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
      <WorldDashboardHeroBanner
        inWorldDateLabel={worldQuery.data.header.inWorldDateLabel}
        isArchived={worldQuery.data.header.isArchived}
        name={worldQuery.data.header.name}
        status={worldQuery.data.header.status}
        visibility={worldQuery.data.header.visibility}
        worldId={worldId}
      />

      {worldQuery.data.header.isArchived ? (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          This world is archived and available for review.
        </p>
      ) : null}

      <WorldDashboardStatTiles worldId={worldId} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SettlementReadinessListPanel
            accessContext={accessContext}
            canAdmin={effectiveCanAdmin}
            canManage={effectiveCanAdmin}
            isArchived={worldQuery.data.header.isArchived}
            worldId={worldId}
          />
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
        </div>
        <div className="flex flex-col gap-4">
          <WorldActiveEventsFeed worldId={worldId} />
          <WorldTurnLogExcerpt worldId={worldId} />
        </div>
        {effectiveCanAdmin ? (
          <div className="xl:col-span-2">
            <WorldReportsSection
              currentTurnNumber={worldQuery.data.header.currentTurnNumber}
              worldId={worldId}
            />
          </div>
        ) : null}
      </div>
    </WorldShellFrame>
  );
}

function WorldShellFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
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
