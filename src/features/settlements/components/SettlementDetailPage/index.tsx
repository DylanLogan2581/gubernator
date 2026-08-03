import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { DetailPageHeader } from "@/components/shared/DetailPageHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  currentAccessContextQueryOptions,
  useActivePlayerCharacter,
  useEffectiveCanAdmin,
  useSettlementManageAuthority,
  type AccessContext,
} from "@/features/permissions";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
  type WorldPermissionContext,
  type WorldRouteAccess,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { settlementByIdQueryOptions } from "../../queries/settlementsQueries";
import { SettlementFlagAvatar } from "../SettlementFlagAvatar";

import { SettlementDetailContext } from "./SettlementDetailContext";
import { SettlementDetailFrame } from "./SettlementDetailFrame";

import type { SettlementWithNation } from "../../types/settlementTypes";
import type { JSX, ReactNode } from "react";

type SettlementDetailPageProps = {
  readonly children: ReactNode;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementDetailPage({
  children,
  nationId,
  settlementId,
  worldId,
}: SettlementDetailPageProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <LoadingState label="Loading world access…" />
      </SettlementDetailFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </SettlementDetailFrame>
    );
  }

  return (
    <SettlementDetailWorldGate
      accessContext={accessContextQuery.data}
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
    >
      {children}
    </SettlementDetailWorldGate>
  );
}

function SettlementDetailWorldGate({
  accessContext,
  children,
  nationId,
  settlementId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly children: ReactNode;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </SettlementDetailFrame>
    );
  }

  if (worldQuery.isPending) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <LoadingState label="Loading world…" />
      </SettlementDetailFrame>
    );
  }

  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <SettlementDetailFrame nationId={nationId} worldId={worldId}>
          <AccessDeniedState
            title="World unavailable"
            description="This world does not exist or your Gubernator account does not have access."
          />
        </SettlementDetailFrame>
      );
    }

    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <ErrorState
          title="World could not be loaded"
          description={getErrorDescription(worldQuery.error)}
        />
      </SettlementDetailFrame>
    );
  }

  return (
    <SettlementDetailContent
      accessContext={accessContext}
      nationId={nationId}
      settlementId={settlementId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    >
      {children}
    </SettlementDetailContent>
  );
}

function SettlementDetailContent({
  accessContext,
  children,
  nationId,
  settlementId,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly children: ReactNode;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const settlementQuery = useQuery(settlementByIdQueryOptions(settlementId));

  if (settlementQuery.isPending) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <LoadingState label="Loading settlement…" />
      </SettlementDetailFrame>
    );
  }

  if (settlementQuery.isError) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <ErrorState
          title="Settlement could not be loaded"
          description={getErrorDescription(settlementQuery.error)}
        />
      </SettlementDetailFrame>
    );
  }

  const settlement = settlementQuery.data;
  if (
    settlement === null ||
    settlement.nation.worldId !== worldId ||
    settlement.nationId !== nationId
  ) {
    return (
      <SettlementDetailFrame nationId={nationId} worldId={worldId}>
        <AccessDeniedState
          title="Settlement unavailable"
          description="This settlement does not exist or is not part of this nation."
        />
      </SettlementDetailFrame>
    );
  }

  return (
    <SettlementDetailLoaded
      accessContext={accessContext}
      settlement={settlement}
      worldAccess={worldAccess}
      worldId={worldId}
    >
      {children}
    </SettlementDetailLoaded>
  );
}

function SettlementDetailLoaded({
  accessContext,
  children,
  settlement,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly children: ReactNode;
  readonly settlement: SettlementWithNation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const isArchived = worldAccess.header.isArchived;
  const effectiveCanAdmin = useEffectiveCanAdmin(worldAccess.canAdmin);
  const { canManageNation, canManageSettlement } = useSettlementManageAuthority(
    {
      canAdmin: effectiveCanAdmin,
      nationId: settlement.nationId,
      settlementId: settlement.id,
    },
  );
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === settlement.nationId &&
    activeCharacter.status === "alive";
  const isSettlementManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "settlement_manager" &&
    activeCharacter.roleSettlementId === settlement.id &&
    activeCharacter.status === "alive";
  const canEditDetails =
    (effectiveCanAdmin || isNationManager || isSettlementManager) &&
    !isArchived;
  const canEditCoordinates = effectiveCanAdmin && !isArchived;
  const canDelete = effectiveCanAdmin && !isArchived;

  return (
    <SettlementDetailFrame
      nationId={settlement.nationId}
      worldId={worldId}
      backLabel={`Back to ${settlement.nation.name}`}
    >
      <DetailPageHeader
        media={
          <SettlementFlagAvatar
            className="w-16 shrink-0"
            flagPath={settlement.flagPath}
            interactive
            settlementId={settlement.id}
            settlementName={settlement.name}
          />
        }
        title={settlement.name}
        context={
          <>
            Settlement in{" "}
            <span className="font-medium">{settlement.nation.name}</span>,{" "}
            <span className="font-medium">{worldAccess.header.name}</span>.
          </>
        }
      />

      <SettlementDetailContext
        value={{
          accessContext,
          canDelete,
          canEditCoordinates,
          canEditDetails,
          canManageNation,
          canManageSettlement,
          effectiveCanAdmin,
          isArchived,
          settlement,
          worldAccess,
          worldId,
        }}
      >
        {children}
      </SettlementDetailContext>
    </SettlementDetailFrame>
  );
}
