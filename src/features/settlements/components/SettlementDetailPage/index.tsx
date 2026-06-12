import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettlementBuildingsPanel } from "@/features/buildings";
import { CitizensPanel, SettlementAssignmentBoard } from "@/features/citizens";
import { SettlementConstructionPanel } from "@/features/construction";
import { SettlementDepositsPanel } from "@/features/deposits";
import { ActiveEventsCard } from "@/features/events";
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
  readonly activeSection: "overview" | "population" | "economy" | "admin";
  readonly assignmentTab: "bulk" | "per-target";
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

export function SettlementDetailPage({
  activeSection,
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
      activeSection={activeSection}
      assignmentTab={assignmentTab}
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
    />
  );
}

function SettlementDetailWorldGate({
  accessContext,
  activeSection,
  assignmentTab,
  nationId,
  settlementId,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly activeSection: "overview" | "population" | "economy" | "admin";
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
      activeSection={activeSection}
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
  activeSection,
  assignmentTab,
  nationId,
  settlementId,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly activeSection: "overview" | "population" | "economy" | "admin";
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
      activeSection={activeSection}
      assignmentTab={assignmentTab}
      settlement={settlement}
      worldAccess={worldAccess}
      worldId={worldId}
    />
  );
}

function SettlementDetailLoaded({
  accessContext,
  activeSection,
  assignmentTab,
  settlement,
  worldAccess,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly activeSection: "overview" | "population" | "economy" | "admin";
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

  const navigate = useNavigate();

  function handleSectionSelect(
    section: "overview" | "population" | "economy" | "admin",
  ): void {
    void navigate({
      to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
      params: {
        worldId,
        nationId: settlement.nationId,
        settlementId: settlement.id,
      },
      search: { section },
      resetScroll: false,
    });
  }

  const SECTIONS = [
    { key: "overview", label: "Overview" },
    { key: "population", label: "Population" },
    { key: "economy", label: "Economy" },
    { key: "admin", label: "Admin" },
  ] as const;

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

      {/* Mobile select — visible below md breakpoint */}
      <div className="md:hidden">
        <NativeSelect
          aria-label="Settlement section"
          className="w-full"
          value={activeSection}
          onChange={(e) =>
            handleSectionSelect(
              e.target.value as "overview" | "population" | "economy" | "admin",
            )
          }
        >
          {SECTIONS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Desktop tab strip — visible from md up */}
      <Tabs
        value={activeSection}
        onValueChange={(v) => {
          handleSectionSelect(
            v as "overview" | "population" | "economy" | "admin",
          );
        }}
      >
        <TabsList className="hidden overflow-x-auto [scrollbar-width:none] md:flex">
          {SECTIONS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key} className="shrink-0">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Overview Section */}
      {activeSection === "overview" ? (
        <>
          <SettlementReadinessSection
            accessContext={accessContext}
            canAdmin={worldAccess.canAdmin}
            canManage={canManageSettlement}
            isArchived={isArchived}
            settlementId={settlement.id}
            worldId={worldId}
          />

          <ActiveEventsCard
            scope="settlement"
            scopeId={settlement.id}
            worldId={worldId}
          />

          <SettlementDetailsSection
            canEdit={canEditDetails}
            queryClient={queryClient}
            settlement={settlement}
          />

          <SettlementCoordinatesSection
            canEdit={canEditCoordinates}
            queryClient={queryClient}
            settlement={settlement}
          />
        </>
      ) : null}

      {/* Population Section */}
      {activeSection === "population" ? (
        <>
          <CitizensPanel
            canAdmin={worldAccess.canAdmin}
            incestPreventionDepth={worldAccess.world.incestPreventionDepth}
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

          <SettlementManagedPopulationsPanel
            canAdmin={worldAccess.canAdmin}
            canManage={canManageSettlement}
            isArchived={isArchived}
            settlementId={settlement.id}
            worldId={worldId}
          />
        </>
      ) : null}

      {/* Economy Section */}
      {activeSection === "economy" ? (
        <>
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

          <SettlementStockpilesPanel
            canAdmin={worldAccess.canAdmin}
            isArchived={isArchived}
            settlementId={settlement.id}
          />

          <SettlementDepositsPanel
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
        </>
      ) : null}

      {/* Admin Section */}
      {activeSection === "admin" ? (
        <>
          {worldAccess.canAdmin ? (
            <SettlementNamesetCard
              canAdmin={worldAccess.canAdmin}
              currentNamesetId={settlement.namesetId}
              isArchived={isArchived}
              settlementId={settlement.id}
              worldId={worldId}
            />
          ) : null}

          {canDelete ? (
            <SettlementDeleteSection
              queryClient={queryClient}
              settlement={settlement}
              worldId={worldId}
            />
          ) : null}
        </>
      ) : null}
    </SettlementDetailFrame>
  );
}
