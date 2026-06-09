import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useEffect, type JSX } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { NationNamesetCard } from "@/features/namesets";
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

import { nationByIdQueryOptions } from "../../queries/nationsQueries";

import { NationDeleteSection } from "./DeleteSection";
import { NationDetailsSection } from "./DetailsSection";
import { NationHiddenToggleSection } from "./HiddenToggleSection";
import { NationDetailFrame } from "./NationDetailFrame";
import { NationRelationshipsSection } from "./RelationshipsSection";
import { NationRoleAssignmentSection } from "./RoleAssignmentSection";
import { NationSettlementsSection } from "./SettlementsSection";

import type { Nation } from "../../types/nationTypes";

type NationDetailPageProps = {
  readonly nationId: string;
  readonly worldId: string;
};

export function NationDetailPage({
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
    />
  );
}

function NationDetailWorldGate({
  accessContext,
  nationId,
  worldId,
}: {
  readonly accessContext: AccessContext;
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
      nationId={nationId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function NationDetailContent({
  nationId,
  worldAccess,
  worldId,
}: {
  readonly nationId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const nationQuery = useQuery(nationByIdQueryOptions(nationId));

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

  if (nation.isHidden && !worldAccess.canAdmin) {
    return <HiddenNationRedirect worldId={worldId} />;
  }

  return (
    <NationDetailLoaded
      nation={nation}
      worldAccess={worldAccess}
      worldId={worldId}
    />
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
  nation,
  worldAccess,
  worldId,
}: {
  readonly nation: Nation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const isArchived = worldAccess.header.isArchived;
  const canEditDetails = worldAccess.canManage && !isArchived;
  const canToggleHidden = worldAccess.canAdmin && !isArchived;
  const canDelete = worldAccess.canAdmin && !isArchived;

  return (
    <NationDetailFrame worldId={worldId}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
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
      </header>

      <NationDetailsSection
        canEdit={canEditDetails}
        nation={nation}
        queryClient={queryClient}
      />

      {canToggleHidden ? (
        <NationHiddenToggleSection nation={nation} queryClient={queryClient} />
      ) : null}

      {worldAccess.canAdmin ? (
        <NationNamesetCard
          canAdmin={worldAccess.canAdmin}
          currentNamesetId={nation.namesetId}
          isArchived={isArchived}
          nationId={nation.id}
          worldId={worldId}
        />
      ) : null}

      <NationSettlementsSection
        canAdmin={worldAccess.canAdmin}
        nationId={nation.id}
        worldId={worldId}
      />

      <NationRoleAssignmentSection
        canAdminWorld={worldAccess.canAdmin}
        isArchived={isArchived}
        nation={nation}
      />

      <NationRelationshipsSection
        canAdminWorld={worldAccess.canAdmin && !isArchived}
        isArchived={isArchived}
        nation={nation}
        queryClient={queryClient}
      />

      {canDelete ? (
        <NationDeleteSection nation={nation} queryClient={queryClient} />
      ) : null}
    </NationDetailFrame>
  );
}
