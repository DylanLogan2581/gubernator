import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, type JSX, type ReactNode } from "react";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
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

  // ActivePlayerCharacterProvider now mounts above the app shell (see
  // AppShellProviders) so the sidebar's character card shares this exact
  // context — this gate only consumes it via useActivePlayerCharacter.
  return (
    <WorldEntryDecision
      accessContext={accessContext}
      worldAccess={worldQuery.data}
      worldId={worldId}
    >
      {children}
    </WorldEntryDecision>
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
  const {
    isExplicitAdminChoice,
    isPending: contextPending,
    selectableCharacters,
  } = useActivePlayerCharacter();
  const autoSelectMutation = useMutation(
    setActivePlayerCharacterMutationOptions({ queryClient }),
  );

  // An explicit admin choice only overrides auto-select while the viewer is
  // still an admin; a demoted admin's stale choice shouldn't permanently
  // lock them out of their only character.
  const skipAutoSelect =
    (isExplicitAdminChoice ?? false) && worldAccess.canAdmin;

  useAutoSelectSinglePlayerCharacter({
    activeRowCitizenId: activeRowQuery.data?.citizenId ?? null,
    isActiveRowPending: activeRowQuery.isPending,
    isContextPending: contextPending,
    mutate: autoSelectMutation.mutate,
    mutationIsPending: autoSelectMutation.isPending,
    selectableCharacters,
    skipAutoSelect,
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
      return <>{children}</>;
    }
    return (
      <AccessDeniedState
        title="No character in this world"
        description="You do not have a living player character in this world. Contact a world administrator to add one."
      />
    );
  }

  if (selectableCharacters.length === 1) {
    return <>{children}</>;
  }

  if (resumedCitizen !== null) {
    return <>{children}</>;
  }

  // No resumed PC — normally that means "pick one," but an admin who
  // deliberately cleared their character to act as admin should re-enter
  // admin mode instead of being forced back into the chooser.
  if (worldAccess.canAdmin && (isExplicitAdminChoice ?? false)) {
    return <>{children}</>;
  }

  return <PlayerCharacterChooser />;
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
  skipAutoSelect,
  userId,
  worldId,
}: {
  readonly activeRowCitizenId: string | null;
  readonly isActiveRowPending: boolean;
  readonly isContextPending: boolean;
  readonly mutate: AutoSelectMutate;
  readonly mutationIsPending: boolean;
  readonly selectableCharacters: readonly { readonly id: string }[];
  readonly skipAutoSelect: boolean;
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
    // Respects a deliberate admin choice: without this, clearing the active
    // row to act as admin races straight back into re-selecting the only PC.
    if (skipAutoSelect) {
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
    skipAutoSelect,
    userId,
    worldId,
  ]);
}
