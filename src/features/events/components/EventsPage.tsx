import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Zap } from "lucide-react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
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

import type { EventsSearchParams } from "../types/eventTypes";
import type { JSX } from "react";

type EventsPageProps = {
  readonly worldId: string;
  readonly search: EventsSearchParams;
};

export function EventsPage({ worldId, search }: EventsPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <EventsPageFrame>
        <LoadingState label="Loading world access…" />
      </EventsPageFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <EventsPageFrame>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </EventsPageFrame>
    );
  }

  return (
    <EventsPageGate
      accessContext={accessContextQuery.data}
      worldId={worldId}
      search={search}
    />
  );
}

function EventsPageGate({
  accessContext,
  worldId,
  search,
}: {
  readonly accessContext: AccessContext;
  readonly worldId: string;
  readonly search: EventsSearchParams;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <EventsPageFrame>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </EventsPageFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <EventsPageFrame>
        <LoadingState label="Loading world…" />
      </EventsPageFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <EventsPageFrame>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </EventsPageFrame>
      );
    }

    return (
      <EventsPageFrame>
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
      search={search}
    />
  );
}

function EventsPageContent({
  accessContext: _accessContext,
  worldAccess,
  worldId,
  search,
}: {
  readonly accessContext: AccessContext;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
  readonly search: EventsSearchParams;
}): JSX.Element {
  const navigate = useNavigate();
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);
  const canManage = effectiveCanAdmin && !worldAccess.header.isArchived;

  return (
    <EventsPageFrame>
      <div className="space-y-6">
        <PageHeader
          icon={Zap}
          title="Events"
          description={
            <>
              World events for{" "}
              <span className="font-medium">{worldAccess.header.name}</span>.
            </>
          }
        />

        <EventsList
          worldId={worldId}
          canCreate={canManage}
          canManage={canManage}
          search={search}
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
