import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useEffect, type JSX, type ReactNode } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
  type AccessContext,
} from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
  type WorldRouteAccess,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { nationByIdQueryOptions } from "../../queries/nationsQueries";
import { NationFlagAvatar } from "../NationFlagAvatar";

import { NationDetailContext } from "./NationDetailContext";
import { NationDetailFrame } from "./NationDetailFrame";

import type { Nation } from "../../types/nationTypes";

type NationDetailPageProps = {
  readonly children: ReactNode;
  readonly nationId: string;
  readonly worldId: string;
};

export function NationDetailPage({
  children,
  nationId,
  worldId,
}: NationDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <NationDetailFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </NationDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <NationDetailFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </NationDetailFrame>
    );
  }

  return (
    <NationDetailWorldGate
      accessContext={accessContextQuery.data}
      nationId={nationId}
      worldId={worldId}
    >
      {children}
    </NationDetailWorldGate>
  );
}

function NationDetailWorldGate({
  accessContext,
  children,
  nationId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly children: ReactNode;
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <NationDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </NationDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <NationDetailFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </NationDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <NationDetailFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </NationDetailFrame>
      );
    }

    return (
      <NationDetailFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </NationDetailFrame>
    );
  }

  return (
    <NationDetailContent
      accessContext={accessContext}
      nationId={nationId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    >
      {children}
    </NationDetailContent>
  );
}

function NationDetailContent({
  accessContext,
  children,
  nationId,
  worldAccess,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly children: ReactNode;
  readonly nationId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const nationQuery = useQuery(nationByIdQueryOptions(nationId));
  // Must be called unconditionally before any early returns to satisfy rules-of-hooks.
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);

  if (nationQuery.isPending) {
    return (
      <NationDetailFrame worldId={worldId}>
        <LoadingState label="Loading nation…" />
      </NationDetailFrame>
    );
  }

  if (nationQuery.isError) {
    return (
      <NationDetailFrame worldId={worldId}>
        <ErrorState
          title="Nation could not be loaded"
          description={getErrorDescription(nationQuery.error)}
        />
      </NationDetailFrame>
    );
  }

  const nation = nationQuery.data;
  if (nation === null || nation.worldId !== worldId) {
    return (
      <NationDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Nation unavailable"
          description="This nation does not exist or is not part of this world."
        />
      </NationDetailFrame>
    );
  }

  if (nation.isHidden && !effectiveCanAdmin) {
    return <HiddenNationRedirect worldId={worldId} />;
  }

  return (
    <NationDetailLoaded
      accessContext={accessContext}
      nation={nation}
      worldAccess={worldAccess}
      worldId={worldId}
    >
      {children}
    </NationDetailLoaded>
  );
}

function HiddenNationRedirect({
  worldId,
}: {
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({
      params: { worldId },
      replace: true,
      to: "/worlds/$worldId/nations",
    });
  }, [navigate, worldId]);

  return (
    <NationDetailFrame worldId={worldId}>
      <LoadingState label="Redirecting…" />
    </NationDetailFrame>
  );
}

function NationDetailLoaded({
  accessContext,
  children,
  nation,
  worldAccess,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly children: ReactNode;
  readonly nation: Nation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const isArchived = worldAccess.header.isArchived;
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);
  const canEditDetails = effectiveCanAdmin && !isArchived;
  const canToggleHidden = effectiveCanAdmin && !isArchived;
  const canDelete = effectiveCanAdmin && !isArchived;

  return (
    <NationDetailFrame worldId={worldId}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <NationFlagAvatar
            className="size-12 shrink-0"
            flagPath={nation.flagPath}
            nationId={nation.id}
          />
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                {nation.name}
              </h1>
              {nation.isHidden ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <LockKeyhole className="size-3" aria-hidden="true" />
                  Hidden
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Nation in{" "}
              <span className="font-medium">{worldAccess.header.name}</span>.
            </p>
          </div>
        </div>
      </header>

      <NationDetailContext
        value={{
          accessContext,
          canDelete,
          canEditDetails,
          canToggleHidden,
          effectiveCanAdmin,
          isArchived,
          nation,
          worldAccess,
          worldId,
        }}
      >
        {children}
      </NationDetailContext>
    </NationDetailFrame>
  );
}
