import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import type { WorldRouteAccess } from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { CitizensDirectoryTable } from "./CitizensDirectoryTable";

type CitizensDirectoryPageProps = {
  readonly worldId: string;
};

export function CitizensDirectoryPage({
  worldId,
}: CitizensDirectoryPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <CitizensDirectoryFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </CitizensDirectoryFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <CitizensDirectoryFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </CitizensDirectoryFrame>
    );
  }

  return (
    <CitizensDirectoryWorldGate
      accessContext={accessContextQuery.data}
      worldId={worldId}
    />
  );
}

function CitizensDirectoryWorldGate({
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
      <CitizensDirectoryFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </CitizensDirectoryFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <CitizensDirectoryFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </CitizensDirectoryFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <CitizensDirectoryFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </CitizensDirectoryFrame>
      );
    }

    return (
      <CitizensDirectoryFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </CitizensDirectoryFrame>
    );
  }

  return (
    <CitizensDirectoryContent worldAccess={worldQuery.data} worldId={worldId} />
  );
}

function CitizensDirectoryContent({
  worldAccess,
  worldId,
}: {
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  return (
    <CitizensDirectoryFrame worldId={worldId}>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-normal">Citizens</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every citizen across{" "}
          <span className="font-medium">{worldAccess.header.name}</span>.
        </p>
      </header>

      <CitizensDirectoryTable worldId={worldId} />
    </CitizensDirectoryFrame>
  );
}

function CitizensDirectoryFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link to="/worlds/$worldId" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to world
        </Link>
      </Button>
      {children}
    </div>
  );
}
