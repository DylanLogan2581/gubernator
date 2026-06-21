import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PartnershipHistoryPanel } from "@/features/partnerships";
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

import {
  citizenAdminDetailsQueryOptions,
  citizenByIdQueryOptions,
} from "../../queries/citizensQueries";

import { CitizenAssignmentSection } from "./AssignmentSection";
import { CitizenDetailFrame } from "./CitizenDetailFrame";
import { CitizenManagerRedirect } from "./CitizenManagerRedirect";
import { CitizenCoreSection } from "./CoreEditForm";
import { CitizenDetailHeader } from "./Header";
import { CitizenLifecycleSection } from "./LifecycleControls";
import { CitizenMemoriesSection } from "./MemoriesSection";
import { CitizenNpcFlavorSection } from "./NpcFlavorSection";
import { CitizenNpcNotesSection } from "./NpcNotesSection";
import { CitizenParentsSection } from "./ParentsSection";
import { CitizenPlayerCharacterSection } from "./PlayerCharacterSection";

import type { Citizen, CitizenAdminDetails } from "../../types/citizenTypes";
import type { QueryClient } from "@tanstack/react-query";
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

  if (!effectiveCanAdmin && !isOwnLivingCharacter) {
    return <CitizenManagerRedirect citizen={citizen} worldId={worldId} />;
  }

  return (
    <CitizenDetailLoaded
      canAdmin={effectiveCanAdmin}
      citizen={citizen}
      currentTurnNumber={worldAccess.header.currentTurnNumber}
      isArchived={worldAccess.header.isArchived}
      worldId={worldId}
    />
  );
}

function CitizenDetailLoaded({
  canAdmin,
  citizen,
  currentTurnNumber,
  isArchived,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

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
      <CitizenDetailHeader citizen={citizen} />

      <CitizenCoreSection
        canEdit={canEdit}
        citizen={citizen}
        queryClient={queryClient}
      />

      <CitizenParentsSection citizen={citizen} />

      <CitizenAssignmentSection citizenId={citizen.id} />

      {citizen.citizenType === "npc" ? (
        <CitizenNpcAdminSections
          canEdit={canEdit}
          citizenId={citizen.id}
          queryClient={queryClient}
          worldId={worldId}
        />
      ) : null}

      {citizen.citizenType === "player_character" ? (
        <CitizenPlayerCharacterSection
          canAdmin={canAdmin}
          canEdit={canEdit}
          citizen={citizen}
          isArchived={isArchived}
          queryClient={queryClient}
        />
      ) : null}

      {canAdmin ? (
        <CitizenMemoriesSection
          canEdit={canEdit}
          citizenId={citizen.id}
          currentTurnNumber={currentTurnNumber}
          queryClient={queryClient}
          worldId={worldId}
        />
      ) : null}

      <PartnershipHistoryPanel
        canAdmin={canAdmin}
        citizen={citizen}
        isArchived={isArchived}
      />

      {canAdmin ? (
        <CitizenLifecycleSection
          citizen={citizen}
          isArchived={isArchived}
          queryClient={queryClient}
        />
      ) : null}
    </CitizenDetailFrame>
  );
}

function CitizenNpcAdminSections({
  canEdit,
  citizenId,
  queryClient,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly citizenId: string;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const adminDetailsQuery = useQuery(
    citizenAdminDetailsQueryOptions(citizenId),
  );

  if (adminDetailsQuery.isPending) {
    return <LoadingState label="Loading NPC details…" />;
  }

  if (adminDetailsQuery.isError) {
    return (
      <ErrorState
        title="NPC details could not be loaded"
        description={getErrorDescription(adminDetailsQuery.error)}
      />
    );
  }

  const adminDetails: CitizenAdminDetails | null = adminDetailsQuery.data;

  return (
    <>
      <CitizenNpcNotesSection
        adminDetails={adminDetails}
        canEdit={canEdit}
        citizenId={citizenId}
        queryClient={queryClient}
        worldId={worldId}
      />
      <CitizenNpcFlavorSection
        adminDetails={adminDetails}
        canEdit={canEdit}
        citizenId={citizenId}
        queryClient={queryClient}
        worldId={worldId}
      />
    </>
  );
}
