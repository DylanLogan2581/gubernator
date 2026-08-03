import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { DetailPageFrame } from "@/components/shared/DetailPageFrame";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  currentAccessContextQueryOptions,
  type AccessContext,
} from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
  type WorldRouteAccess,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import type { JSX, ReactNode } from "react";

function NamesetPageFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <DetailPageFrame
      backLink={
        <Link
          to="/worlds/$worldId/configuration"
          params={{ worldId }}
          search={{ tab: "namesets" }}
        >
          <ArrowLeft aria-hidden="true" />
          Back to namesets
        </Link>
      }
    >
      {children}
    </DetailPageFrame>
  );
}

type NamesetPageShellProps = {
  readonly children: (props: {
    readonly worldAccess: WorldRouteAccess;
  }) => ReactNode;
  readonly worldId: string;
};

/**
 * Resolves world access for the dedicated nameset create/edit pages and wraps
 * the content in a back-to-namesets frame. Mirrors the gating used by the
 * lore-entity detail pages so standalone nameset routes enforce the same
 * account/world access decisions the config tab does.
 */
export function NamesetPageShell({
  children,
  worldId,
}: NamesetPageShellProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <NamesetPageFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </NamesetPageFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <NamesetPageFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </NamesetPageFrame>
    );
  }

  return (
    <NamesetPageWorldGate
      accessContext={accessContextQuery.data}
      worldId={worldId}
    >
      {children}
    </NamesetPageWorldGate>
  );
}

function NamesetPageWorldGate({
  accessContext,
  children,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly children: (props: {
    readonly worldAccess: WorldRouteAccess;
  }) => ReactNode;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <NamesetPageFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </NamesetPageFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <NamesetPageFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </NamesetPageFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <NamesetPageFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </NamesetPageFrame>
      );
    }

    return (
      <NamesetPageFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </NamesetPageFrame>
    );
  }

  return (
    <NamesetPageFrame worldId={worldId}>
      {children({ worldAccess: worldQuery.data })}
    </NamesetPageFrame>
  );
}
