import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  SettlementBuildingsPanel,
  SettlementConstructionPanel,
} from "@/features/buildings";
import { CitizensPanel, SettlementAssignmentBoard } from "@/features/citizens";
import { SettlementDepositsPanel } from "@/features/deposits";
import { SettlementManagedPopulationsPanel } from "@/features/managed-populations";
import { SettlementNamesetCard } from "@/features/namesets";
import {
  currentAccessContextQueryOptions,
  useActivePlayerCharacter,
  useSettlementManageAuthority,
  type AccessContext,
} from "@/features/permissions";
import { SettlementStockpilesPanel } from "@/features/resources";
import { SettlementTradeRoutesPanel } from "@/features/trade";
import { TurnTransitionOutcomePanel } from "@/features/turns";
import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
  type WorldPermissionContext,
  type WorldRouteAccess,
} from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { settlementByIdQueryOptions } from "../../queries/settlementsQueries";

import { SettlementCoordinatesSection } from "./CoordinatesSection";
import { SettlementDeleteSection } from "./DeleteSection";
import { SettlementDetailsSection } from "./DetailsSection";
import { SettlementReadinessSection } from "./ReadinessSection";
import { SettlementDetailFrame } from "./SettlementDetailFrame";

import type { SettlementWithNation } from "../../types/settlementTypes";
import type { JSX } from "react";

type SettlementDetailPageProps = {
  readonly assignmentTab: "bulk" | "per-target";
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementDetailPage({
  assignmentTab,
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
      assignmentTab={assignmentTab}
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
    />
  );
}

function SettlementDetailWorldGate({
  accessContext,
  assignmentTab,
  nationId,
  settlementId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly assignmentTab: "bulk" | "per-target";
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
      assignmentTab={assignmentTab}
      nationId={nationId}
      settlementId={settlementId}
      worldAccess={worldQuery.data}
      worldId={worldId}
    />
  );
}

function SettlementDetailContent({
  accessContext,
  assignmentTab,
  nationId,
  settlementId,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly assignmentTab: "bulk" | "per-target";
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
      assignmentTab={assignmentTab}
      settlement={settlement}
      worldAccess={worldAccess}
      worldId={worldId}
    />
  );
}

function SettlementDetailLoaded({
  accessContext,
  assignmentTab,
  settlement,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly assignmentTab: "bulk" | "per-target";
  readonly settlement: SettlementWithNation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const { activeCharacter } = useActivePlayerCharacter();
  const isArchived = worldAccess.header.isArchived;
  const { canManageSettlement } = useSettlementManageAuthority({
    canAdmin: worldAccess.canAdmin,
    nationId: settlement.nationId,
    settlementId: settlement.id,
  });
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
    (worldAccess.canAdmin || isNationManager || isSettlementManager) &&
    !isArchived;
  const canEditCoordinates = worldAccess.canAdmin && !isArchived;
  const canDelete = worldAccess.canAdmin && !isArchived;

  return (
    <SettlementDetailFrame
      nationId={settlement.nationId}
      worldId={worldId}
      backLabel={`Back to ${settlement.nation.name}`}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {settlement.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Settlement in{" "}
            <span className="font-medium">{settlement.nation.name}</span>,{" "}
            <span className="font-medium">{worldAccess.header.name}</span>.
          </p>
        </div>
      </header>

      <TurnTransitionOutcomePanel scope="settlement" id={settlement.id} />

      <SettlementReadinessSection
        accessContext={accessContext}
        canAdmin={worldAccess.canAdmin}
        canManage={canManageSettlement}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementStockpilesPanel
        canAdmin={worldAccess.canAdmin}
        isArchived={isArchived}
        settlementId={settlement.id}
      />

      <SettlementDetailsSection
        canEdit={canEditDetails}
        queryClient={queryClient}
        settlement={settlement}
      />

      {worldAccess.canAdmin ? (
        <SettlementNamesetCard
          canAdmin={worldAccess.canAdmin}
          currentNamesetId={settlement.namesetId}
          isArchived={isArchived}
          settlementId={settlement.id}
          worldId={worldId}
        />
      ) : null}

      <SettlementCoordinatesSection
        canEdit={canEditCoordinates}
        queryClient={queryClient}
        settlement={settlement}
      />

      <CitizensPanel
        canAdmin={worldAccess.canAdmin}
        incestPreventionDepth={worldAccess.world.incestPreventionDepth}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementBuildingsPanel
        canAdmin={worldAccess.canAdmin}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementConstructionPanel
        canManageSettlement={canManageSettlement}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementDepositsPanel
        canAdmin={worldAccess.canAdmin}
        canManage={canManageSettlement}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementManagedPopulationsPanel
        canAdmin={worldAccess.canAdmin}
        canManage={canManageSettlement}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementTradeRoutesPanel
        canManage={canManageSettlement}
        isArchived={isArchived}
        settlementId={settlement.id}
        worldId={worldId}
      />

      <SettlementAssignmentBoard
        activeTab={assignmentTab}
        canManageSettlement={canManageSettlement}
        isArchived={isArchived}
        nationId={settlement.nationId}
        settlementId={settlement.id}
        worldId={worldId}
      />

      {canDelete ? (
        <SettlementDeleteSection
          queryClient={queryClient}
          settlement={settlement}
          worldId={worldId}
        />
      ) : null}
    </SettlementDetailFrame>
  );
}
