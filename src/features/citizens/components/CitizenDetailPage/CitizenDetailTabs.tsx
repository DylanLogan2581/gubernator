import { useQuery, type QueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnershipHistoryPanel } from "@/features/partnerships";
import { RoleAssignmentControls } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizenAdminDetailsQueryOptions } from "../../queries/citizensQueries";

import { CitizenAssignmentSection } from "./AssignmentSection";
import { CitizenCoreSection } from "./CoreEditForm";
import { CitizenCultureReligionEditSection } from "./CultureReligionEditSection";
import { CitizenEducationEditSection } from "./EducationEditSection";
import { CitizenFamilyTreeSection } from "./FamilyTreeSection";
import { useCitizenCoreEditState } from "./hooks/UseCitizenCoreEditState";
import { CitizenLifecycleSection } from "./LifecycleControls";
import { CitizenMemoriesSection } from "./MemoriesSection";
import { CitizenNpcFlavorSection } from "./NpcFlavorSection";
import { CitizenNpcNotesSection } from "./NpcNotesSection";
import { CitizenPlayerCharacterSection } from "./PlayerCharacterSection";

import type { Citizen, CitizenAdminDetails } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenDetailTabs({
  canAdmin,
  citizen,
  currentTurnNumber,
  isArchived,
  isOwnLivingCharacter,
  queryClient,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
  readonly currentTurnNumber: number;
  readonly isArchived: boolean;
  readonly isOwnLivingCharacter: boolean;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const canEdit = canAdmin && !isArchived;
  const coreEditState = useCitizenCoreEditState(citizen);
  const showLinkedUserReadout =
    citizen.citizenType === "player_character" &&
    (canAdmin || isOwnLivingCharacter);
  const showNpcAdminInfo = canAdmin && citizen.citizenType === "npc";

  return (
    <Tabs className="min-w-0" defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="family">Family</TabsTrigger>
        {canAdmin ? <TabsTrigger value="memories">Memories</TabsTrigger> : null}
        {canAdmin ? <TabsTrigger value="edit">Edit</TabsTrigger> : null}
      </TabsList>

      <TabsContent className="grid gap-4" value="overview">
        <CitizenAssignmentSection citizenId={citizen.id} />
        {showLinkedUserReadout ? (
          <CitizenPlayerCharacterSection
            canAdmin={canAdmin}
            canEdit={false}
            citizen={citizen}
            queryClient={queryClient}
          />
        ) : null}
        {showNpcAdminInfo ? (
          <CitizenNpcAdminSections
            canEdit={false}
            citizen={citizen}
            currentTurnNumber={currentTurnNumber}
            queryClient={queryClient}
            worldId={worldId}
          />
        ) : null}
      </TabsContent>

      <TabsContent className="grid gap-4" value="family">
        <CitizenFamilyTreeSection citizen={citizen} />
        <PartnershipHistoryPanel
          canAdmin={canAdmin}
          citizen={citizen}
          isArchived={isArchived}
        />
      </TabsContent>

      {canAdmin ? (
        <TabsContent className="grid gap-4" value="memories">
          <CitizenMemoriesSection
            canEdit={canEdit}
            citizenId={citizen.id}
            currentTurnNumber={currentTurnNumber}
            queryClient={queryClient}
            worldId={worldId}
          />
        </TabsContent>
      ) : null}

      {canAdmin ? (
        <TabsContent className="grid gap-4" value="edit">
          <CitizenCoreSection
            canEdit={canEdit}
            citizen={citizen}
            editState={coreEditState}
            queryClient={queryClient}
          />
          <CitizenCultureReligionEditSection
            canEdit={canEdit}
            citizen={citizen}
            queryClient={queryClient}
          />
          <CitizenEducationEditSection
            canEdit={canEdit}
            citizen={citizen}
            queryClient={queryClient}
          />
          {citizen.citizenType === "player_character" ? (
            <CitizenPlayerCharacterSection
              canAdmin={canAdmin}
              canEdit={canEdit}
              citizen={citizen}
              queryClient={queryClient}
            />
          ) : null}
          <RoleAssignmentControls
            canAdminWorld={canAdmin}
            citizen={citizen}
            isArchived={isArchived}
            variant="citizen"
          />
          {citizen.citizenType === "npc" ? (
            <CitizenNpcAdminSections
              canEdit={canEdit}
              citizen={citizen}
              currentTurnNumber={currentTurnNumber}
              queryClient={queryClient}
              worldId={worldId}
            />
          ) : null}
          <CitizenLifecycleSection
            citizen={citizen}
            isArchived={isArchived}
            queryClient={queryClient}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function CitizenNpcAdminSections({
  canEdit,
  citizen,
  currentTurnNumber,
  queryClient,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly currentTurnNumber: number;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const adminDetailsQuery = useQuery(
    citizenAdminDetailsQueryOptions(citizen.id),
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
        citizenId={citizen.id}
        queryClient={queryClient}
        worldId={worldId}
      />
      <CitizenNpcFlavorSection
        adminDetails={adminDetails}
        canEdit={canEdit}
        citizen={citizen}
        currentTurnNumber={currentTurnNumber}
        queryClient={queryClient}
        worldId={worldId}
      />
    </>
  );
}
