import { useQuery, type QueryClient } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnershipHistoryPanel } from "@/features/partnerships";
import { getErrorDescription } from "@/lib/errorUtils";

import { citizenAdminDetailsQueryOptions } from "../../queries/citizensQueries";

import { CitizenAssignmentSection } from "./AssignmentSection";
import { CitizenCoreSection } from "./CoreEditForm";
import { CitizenLifecycleSection } from "./LifecycleControls";
import { CitizenMemoriesSection } from "./MemoriesSection";
import { CitizenNpcFlavorSection } from "./NpcFlavorSection";
import { CitizenNpcNotesSection } from "./NpcNotesSection";
import { CitizenParentsSection } from "./ParentsSection";
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
  const showPlayerCharacterSection =
    citizen.citizenType === "player_character" &&
    (canAdmin || isOwnLivingCharacter);
  const showNpcTab = canAdmin && citizen.citizenType === "npc";

  return (
    <Tabs className="min-w-0" defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="family">Family</TabsTrigger>
        {canAdmin ? <TabsTrigger value="memories">Memories</TabsTrigger> : null}
        {canAdmin ? (
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
        ) : null}
        {showNpcTab ? <TabsTrigger value="npc">NPC</TabsTrigger> : null}
        {canAdmin ? <TabsTrigger value="core">Core edit</TabsTrigger> : null}
      </TabsList>

      <TabsContent className="grid gap-4" value="overview">
        <CitizenAssignmentSection citizenId={citizen.id} />
        {showPlayerCharacterSection ? (
          <CitizenPlayerCharacterSection
            canAdmin={canAdmin}
            canEdit={canEdit}
            citizen={citizen}
            isArchived={isArchived}
            queryClient={queryClient}
          />
        ) : null}
      </TabsContent>

      <TabsContent className="grid gap-4" value="family">
        <CitizenParentsSection citizen={citizen} />
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
        <TabsContent className="grid gap-4" value="lifecycle">
          <CitizenLifecycleSection
            citizen={citizen}
            isArchived={isArchived}
            queryClient={queryClient}
          />
        </TabsContent>
      ) : null}

      {showNpcTab ? (
        <TabsContent className="grid gap-4" value="npc">
          <CitizenNpcAdminSections
            canEdit={canEdit}
            citizenId={citizen.id}
            queryClient={queryClient}
            worldId={worldId}
          />
        </TabsContent>
      ) : null}

      {canAdmin ? (
        <TabsContent className="grid gap-4" value="core">
          <CitizenCoreSection
            canEdit={canEdit}
            citizen={citizen}
            queryClient={queryClient}
          />
        </TabsContent>
      ) : null}
    </Tabs>
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
