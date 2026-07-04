import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
} from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import type { WorldRouteAccess } from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { EventsList } from "./EventsList";
import { EventsPageFrame } from "./EventsPageFrame";

import type { JSX } from "react";

type EventsPageProps = {
  readonly worldId: string;
};

export function EventsPage({ worldId }: EventsPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <EventsPageFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </EventsPageFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <EventsPageFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </EventsPageFrame>
    );
  }

  return (
    <EventsPageGate accessContext={accessContextQuery.data} worldId={worldId} />
  );
}

function EventsPageGate({
  accessContext,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <EventsPageFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </EventsPageFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <EventsPageFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </EventsPageFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <EventsPageFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </EventsPageFrame>
      );
    }

    return (
      <EventsPageFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </EventsPageFrame>
    );
  }

  return (
    <EventsPageContent
      accessContext={accessContext}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function EventsPageContent({
  accessContext: _accessContext,
  worldAccess,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);

  return (
    <EventsPageFrame worldId={worldId}>
      <div className="space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-normal">Events</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              World events for{" "}
              <span className="font-medium">{worldAccess.header.name}</span>.
            </p>
          </div>
        </header>

        <EventsList
          worldId={worldId}
          canCreate={effectiveCanAdmin && !worldAccess.header.isArchived}
          onCreateClick={() => {
            void navigate({
              to: "/worlds/$worldId/events/new",
              params: { worldId },
            });
          }}
        />
      </div>
    </EventsPageFrame>
  );
}
