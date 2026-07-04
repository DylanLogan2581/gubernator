import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  currentAccessContextQueryOptions,
  useEffectiveCanAdmin,
  type AccessContext,
} from "@/features/permissions";
import { settlementByIdQueryOptions } from "@/features/settlements";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
  type WorldRouteAccess,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizenByIdQueryOptions } from "../../queries/citizensQueries";

import { CitizenDetailFrame } from "./CitizenDetailFrame";
import { CitizenDetailTabs } from "./CitizenDetailTabs";
import { CitizenIdentityCard } from "./CitizenIdentityCard";
import { CitizenSiblingNav } from "./CitizenSiblingNav";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

type CitizenDetailPageProps = {
  readonly citizenId: string;
  readonly worldId: string;
};

export function CitizenDetailPage({
  citizenId,
  worldId,
}: CitizenDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </CitizenDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </CitizenDetailFrame>
    );
  }

  return (
    <CitizenDetailWorldGate
      accessContext={accessContextQuery.data}
      citizenId={citizenId}
      worldId={worldId}
    />
  );
}

function CitizenDetailWorldGate({
  accessContext,
  citizenId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly citizenId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </CitizenDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <LoadingState label="Loading world…" />
      </CitizenDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <CitizenDetailFrame worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </CitizenDetailFrame>
      );
    }

    return (
      <CitizenDetailFrame worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </CitizenDetailFrame>
    );
  }

  return (
    <CitizenDetailContent
      accessContext={accessContext}
      citizenId={citizenId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function CitizenDetailContent({
  accessContext,
  citizenId,
  worldAccess,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly citizenId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const citizenQuery = useQuery(citizenByIdQueryOptions(citizenId));
  // Must be called unconditionally before any early returns to satisfy rules-of-hooks.
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);

  if (citizenQuery.isPending) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <LoadingState label="Loading citizen…" />
      </CitizenDetailFrame>
    );
  }

  if (citizenQuery.isError) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <ErrorState
          title="Citizen could not be loaded"
          description={getErrorDescription(citizenQuery.error)}
        />
      </CitizenDetailFrame>
    );
  }

  const citizen = citizenQuery.data;
  if (citizen === null || citizen.worldId !== worldId) {
    return (
      <CitizenDetailFrame worldId={worldId}>
        <AccessDeniedState
          title="Citizen unavailable"
          description="This citizen does not exist or is not part of this world."
        />
      </CitizenDetailFrame>
    );
  }

  const isOwnLivingCharacter =
    citizen.status === "alive" &&
    citizen.userId !== null &&
    citizen.userId === accessContext.userId;

  // Everyone who can see this world can view any citizen's public info here;
  // only edit affordances and admin-only sections are gated on canAdmin below.
  return (
    <CitizenDetailLoaded
      canAdmin={effectiveCanAdmin}
      citizen={citizen}
      currentTurnNumber={worldAccess.header.currentTurnNumber}
      isArchived={worldAccess.header.isArchived}
      isOwnLivingCharacter={isOwnLivingCharacter}
      worldId={worldId}
    />
  );
}

function CitizenDetailLoaded({
  canAdmin,
  citizen,
  currentTurnNumber,
  isArchived,
  isOwnLivingCharacter,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly isOwnLivingCharacter: boolean;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();

  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(citizen.settlementId ?? ""),
    enabled: citizen.settlementId !== null,
  });
  const settlement = settlementQuery.data ?? null;
  const settlementNav =
    settlement !== null
      ? {
          nationId: settlement.nationId,
          settlementId: settlement.id,
          settlementName: settlement.name,
        }
      : null;

  return (
    <CitizenDetailFrame settlementNav={settlementNav} worldId={worldId}>
      <CitizenSiblingNav citizen={citizen} worldId={worldId} />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <CitizenIdentityCard citizen={citizen} settlement={settlement} />

        <CitizenDetailTabs
          canAdmin={canAdmin}
          citizen={citizen}
          currentTurnNumber={currentTurnNumber}
          isArchived={isArchived}
          isOwnLivingCharacter={isOwnLivingCharacter}
          queryClient={queryClient}
          worldId={worldId}
        />
      </div>
    </CitizenDetailFrame>
  );
}
