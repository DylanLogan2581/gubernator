import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { EventDetail } from "@/features/events";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import type { JSX } from "react";

function EventDetailRoute(): JSX.Element {
  const params = Route.useParams();
  const { worldId, eventId } = params;
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return <LoadingState label="Loading world access…" />;
  }

  if (accessContextQuery.isError) {
    return (
      <ErrorState
        title="World access could not be loaded"
        description={getErrorDescription(accessContextQuery.error)}
      />
    );
  }

  return (
    <EventDetailGate
      accessContext={accessContextQuery.data}
      worldId={worldId}
      eventId={eventId}
    />
  );
}

function EventDetailGate({
  accessContext,
  worldId,
  eventId,
}: {
  readonly accessContext: AccessContext;
  readonly worldId: string;
  readonly eventId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <AccessDeniedState
        title="Account access unavailable"
        description="Your Gubernator account is not active. Contact an administrator to restore access."
      />
    );
  }

  if (worldQuery.isPending) {
    return <LoadingState label="Loading world…" />;
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <AccessDeniedState
          title="World unavailable"
          description="This world does not exist or your Gubernator account does not have access."
        />
      );
    }

    return (
      <ErrorState
        title="World could not be loaded"
        description={getErrorDescription(worldQuery.error)}
      />
    );
  }

  return (
    <EventDetail
      worldId={worldId}
      eventId={eventId}
      canCancel={worldQuery.data.canAdmin}
    />
  );
}

export const Route = createFileRoute("/worlds/$worldId/events/$eventId")({
  component: EventDetailRoute,
});
