import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
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
      <CitizensDirectoryFrame>
        <LoadingState label="Loading world access…" />
      </CitizensDirectoryFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <CitizensDirectoryFrame>
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
      <CitizensDirectoryFrame>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </CitizensDirectoryFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <CitizensDirectoryFrame>
        <LoadingState label="Loading world…" />
      </CitizensDirectoryFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <CitizensDirectoryFrame>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </CitizensDirectoryFrame>
      );
    }

    return (
      <CitizensDirectoryFrame>
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
    <CitizensDirectoryFrame>
      <PageHeader
        icon={Users}
        title="Citizens"
        description={
          <>
            Every citizen across{" "}
            <span className="font-medium">{worldAccess.header.name}</span>.
          </>
        }
      />

      <CitizensDirectoryTable worldId={worldId} />
    </CitizensDirectoryFrame>
  );
}

function CitizensDirectoryFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className="flex flex-col gap-4">{children}</div>;
}
