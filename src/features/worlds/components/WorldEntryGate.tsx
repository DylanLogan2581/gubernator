import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, type JSX, type ReactNode } from "react";

import { WorldContextBar } from "@/components/app/WorldContextBar";
import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  ActiveCharacterSwitcher,
  ActivePlayerCharacterProvider,
  PlayerCharacterChooser,
  activePlayerCharacterRowQueryOptions,
  currentAccessContextQueryOptions,
  setActivePlayerCharacterMutationOptions,
  useActivePlayerCharacter,
  type AccessContext,
} from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";

import {
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "../queries/worldQueries";

import type { WorldRouteAccess } from "../types/worldTypes";

type WorldEntryGateProps = {
  readonly children: ReactNode;
  readonly worldId: string;
};

// Gate that implements the world-entry decision (feature guide 2.4):
//   - admin without a character -> admin direct entry
//   - exactly one selectable PC -> auto-select + enter
//   - multiple selectable PCs -> resume if a persisted active row still
//     resolves to a selectable PC; otherwise show the chooser
//   - no access path -> access denied
// The chooser is rendered inline at the world URL so deep links to the
// destination are preserved across selection.
export function WorldEntryGate({
  children,
  worldId,
}: WorldEntryGateProps): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return <LoadingState label="Loading session…" />;
  }
  if (accessContextQuery.isError) {
    return (
      <ErrorState
        title="Session could not be loaded"
        description={getErrorDescription(accessContextQuery.error)}
      />
    );
  }

  const accessContext = accessContextQuery.data;

  // Authenticated but inactive: account access unavailable. Authenticated
  // users with no session are handled by the parent route's auth guard.
  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <AccessDeniedState
        title="Account access unavailable"
        description="Your Gubernator account is not active. Contact an administrator to restore access."
      />
    );
  }

  // Not authenticated: fall through to children — sub-screens render their
  // own access denied state once the route guard completes.
  if (!accessContext.isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <WorldEntryWorldGate accessContext={accessContext} worldId={worldId}>
      {children}
    </WorldEntryWorldGate>
  );
}

// We resolve the world before mounting the active-player-character provider
// because if the world is inaccessible, downstream UI shows its own access
// state and we have no reason to query PCs.
function WorldEntryWorldGate({
  accessContext,
  children,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  const worldQuery = useQuery(
    worldRouteAccessQueryOptions(worldId, accessContext),
  );

  if (worldQuery.isPending) {
    return <LoadingState label="Loading world…" />;
  }
  if (worldQuery.isError) {
    if (isWorldNotFoundError(worldQuery.error)) {
      return (
        <AccessDeniedState
          title="World unavailable"
          description="This world does not exist or your Gubernator account does not have access."
        />
      );
    }
    return (
      <ErrorState
        title="World could not be loaded"
        description={getErrorDescription(worldQuery.error)}
      />
    );
  }

  return (
    <ActivePlayerCharacterProvider
      userId={accessContext.userId}
      worldId={worldId}
    >
      <WorldEntryDecision
        accessContext={accessContext}
        worldAccess={worldQuery.data}
        worldId={worldId}
      >
        {children}
      </WorldEntryDecision>
    </ActivePlayerCharacterProvider>
  );
}

function WorldEntryDecision({
  accessContext,
  children,
  worldAccess,
  worldId,
}: {
  readonly accessContext: AccessContext;
  readonly children: ReactNode;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const userId = accessContext.userId;
  const activeRowQuery = useQuery({
    ...activePlayerCharacterRowQueryOptions(userId ?? "", worldId),
    enabled: userId !== null,
  });
  const { isPending: contextPending, selectableCharacters } =
    useActivePlayerCharacter();
  const autoSelectMutation = useMutation(
    setActivePlayerCharacterMutationOptions({ queryClient }),
  );

  useAutoSelectSinglePlayerCharacter({
    activeRowCitizenId: activeRowQuery.data?.citizenId ?? null,
    isActiveRowPending: activeRowQuery.isPending,
    isContextPending: contextPending,
    mutate: autoSelectMutation.mutate,
    mutationIsPending: autoSelectMutation.isPending,
    selectableCharacters,
    userId,
    worldId,
  });

  if (contextPending || activeRowQuery.isPending) {
    return <LoadingState label="Preparing world…" />;
  }

  const activeRow = activeRowQuery.data ?? null;
  const resumedCitizen =
    activeRow === null
      ? null
      : (selectableCharacters.find(
          (candidate) => candidate.id === activeRow.citizenId,
        ) ?? null);

  if (selectableCharacters.length === 0) {
    if (worldAccess.canAdmin) {
      return (
        <WorldEntryContent
          canAdmin
          worldId={worldId}
          worldName={worldAccess.world.name}
        >
          {children}
        </WorldEntryContent>
      );
    }
    return (
      <AccessDeniedState
        title="No character in this world"
        description="You do not have a living player character in this world. Contact a world administrator to add one."
      />
    );
  }

  if (selectableCharacters.length === 1) {
    return (
      <WorldEntryContent
        canAdmin={worldAccess.canAdmin}
        worldId={worldId}
        worldName={worldAccess.world.name}
      >
        {children}
      </WorldEntryContent>
    );
  }

  if (resumedCitizen !== null) {
    return (
      <WorldEntryContent
        canAdmin={worldAccess.canAdmin}
        worldId={worldId}
        worldName={worldAccess.world.name}
      >
        {children}
      </WorldEntryContent>
    );
  }

  return <PlayerCharacterChooser />;
}

function WorldEntryContent({
  canAdmin,
  children,
  worldId,
  worldName,
}: {
  readonly canAdmin: boolean;
  readonly children: ReactNode;
  readonly worldId: string;
  readonly worldName: string;
}): JSX.Element {
  return (
    <>
      <WorldContextBar worldId={worldId} worldName={worldName}>
        <ActiveCharacterSwitcher canAdmin={canAdmin} worldId={worldId} />
      </WorldContextBar>
      {children}
    </>
  );
}

type AutoSelectMutate = (input: {
  readonly citizenId: string;
  readonly userId: string;
  readonly worldId: string;
}) => void;

function useAutoSelectSinglePlayerCharacter({
  activeRowCitizenId,
  isActiveRowPending,
  isContextPending,
  mutate,
  mutationIsPending,
  selectableCharacters,
  userId,
  worldId,
}: {
  readonly activeRowCitizenId: string | null;
  readonly isActiveRowPending: boolean;
  readonly isContextPending: boolean;
  readonly mutate: AutoSelectMutate;
  readonly mutationIsPending: boolean;
  readonly selectableCharacters: readonly { readonly id: string }[];
  readonly userId: string | null;
  readonly worldId: string;
}): void {
  useEffect(() => {
    if (isContextPending || isActiveRowPending) {
      return;
    }
    if (mutationIsPending) {
      return;
    }
    if (selectableCharacters.length !== 1) {
      return;
    }
    if (userId === null) {
      return;
    }
    const onlyPc = selectableCharacters[0];
    if (onlyPc === undefined) {
      return;
    }
    if (activeRowCitizenId === onlyPc.id) {
      return;
    }
    mutate({ citizenId: onlyPc.id, userId, worldId });
  }, [
    activeRowCitizenId,
    isActiveRowPending,
    isContextPending,
    mutate,
    mutationIsPending,
    selectableCharacters,
    userId,
    worldId,
  ]);
}
