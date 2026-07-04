import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { type Citizen } from "@/features/citizens";

import {
  clearActivePlayerCharacterMutationOptions,
  setActivePlayerCharacterMutationOptions,
} from "../mutations/activePlayerCharacterMutations";
import {
  activePlayerCharacterRowQueryOptions,
  selectablePlayerCharactersQueryOptions,
} from "../queries/activePlayerCharacterQueries";
import {
  readExplicitAdminChoice,
  writeExplicitAdminChoice,
} from "../utils/explicitAdminChoice";

import {
  ActivePlayerCharacterContext,
  type ActivePlayerCharacterContextValue,
} from "./activePlayerCharacterContext";

import type { JSX, ReactNode } from "react";

export type ActivePlayerCharacterProviderProps = {
  readonly children: ReactNode;
  readonly userId: string | null;
  readonly worldId: string;
};

export function ActivePlayerCharacterProvider({
  children,
  userId,
  worldId,
}: ActivePlayerCharacterProviderProps): JSX.Element {
  const queryClient = useQueryClient();

  const selectableEnabled = userId !== null;
  const selectableQuery = useQuery({
    ...selectablePlayerCharactersQueryOptions(userId ?? "", worldId),
    enabled: selectableEnabled,
  });
  const activeRowQuery = useQuery({
    ...activePlayerCharacterRowQueryOptions(userId ?? "", worldId),
    enabled: selectableEnabled,
  });

  const { mutate: setActiveMutate, isPending: setActivePending } = useMutation(
    setActivePlayerCharacterMutationOptions({ queryClient }),
  );
  const { mutate: clearActiveMutate, isPending: clearActivePending } =
    useMutation(clearActivePlayerCharacterMutationOptions({ queryClient }));

  const selectableCharacters = useMemo<readonly Citizen[]>(
    () => selectableQuery.data ?? [],
    [selectableQuery.data],
  );

  const activeRow = activeRowQuery.data ?? null;
  const activeCharacter = useMemo<Citizen | null>(() => {
    if (activeRow === null) {
      return null;
    }
    return (
      selectableCharacters.find(
        (candidate) => candidate.id === activeRow.citizenId,
      ) ?? null
    );
  }, [activeRow, selectableCharacters]);

  // Tracks whether the viewer deliberately entered Admin mode, as opposed to
  // simply having no active-PC row (e.g. before their first selection).
  // Re-read whenever the (user, world) pair changes so switching worlds
  // doesn't carry a stale choice — done during render (React's documented
  // "adjusting state when a prop changes" pattern), not in an effect, so it
  // takes effect in the same commit instead of causing an extra render; see
  // explicitAdminChoice.ts for why this lives in localStorage rather than a
  // DB column.
  const [explicitAdminChoiceKey, setExplicitAdminChoiceKey] = useState({
    userId,
    worldId,
  });
  const [storedExplicitAdminChoice, setStoredExplicitAdminChoice] = useState(
    () => userId !== null && readExplicitAdminChoice(userId, worldId),
  );

  if (
    explicitAdminChoiceKey.userId !== userId ||
    explicitAdminChoiceKey.worldId !== worldId
  ) {
    setExplicitAdminChoiceKey({ userId, worldId });
    setStoredExplicitAdminChoice(
      userId !== null && readExplicitAdminChoice(userId, worldId),
    );
  }

  const setExplicitAdminChoice = useCallback(
    (nextValue: boolean) => {
      setStoredExplicitAdminChoice(nextValue);
      if (userId !== null) {
        writeExplicitAdminChoice(userId, worldId, nextValue);
      }
    },
    [userId, worldId],
  );

  const switchTo = useCallback(
    (citizenId: string) => {
      if (userId === null) {
        return;
      }
      setExplicitAdminChoice(false);
      setActiveMutate({ citizenId, userId, worldId });
    },
    [setActiveMutate, setExplicitAdminChoice, userId, worldId],
  );

  // Doubles as "enter Admin mode": drops the active PC row AND marks the
  // choice explicit, so useAutoSelectSinglePlayerCharacter in WorldEntryGate
  // backs off instead of immediately re-selecting the only PC (issue #978).
  const clear = useCallback(() => {
    if (userId === null) {
      return;
    }
    setExplicitAdminChoice(true);
    clearActiveMutate({ userId, worldId });
  }, [clearActiveMutate, setExplicitAdminChoice, userId, worldId]);

  const isPending =
    (selectableEnabled && selectableQuery.isPending) ||
    (selectableEnabled && activeRowQuery.isPending) ||
    setActivePending ||
    clearActivePending;

  const value = useMemo<ActivePlayerCharacterContextValue>(
    () => ({
      activeCharacter,
      clear,
      isExplicitAdminChoice: storedExplicitAdminChoice,
      isPending,
      selectableCharacters,
      switchTo,
    }),
    [
      activeCharacter,
      clear,
      isPending,
      selectableCharacters,
      storedExplicitAdminChoice,
      switchTo,
    ],
  );

  return (
    <ActivePlayerCharacterContext value={value}>
      {children}
    </ActivePlayerCharacterContext>
  );
}
