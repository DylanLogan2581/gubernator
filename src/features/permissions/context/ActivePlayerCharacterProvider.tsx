import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

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

  const switchTo = useCallback(
    (citizenId: string) => {
      if (userId === null) {
        return;
      }
      setActiveMutate({ citizenId, userId, worldId });
    },
    [setActiveMutate, userId, worldId],
  );

  const clear = useCallback(() => {
    if (userId === null) {
      return;
    }
    clearActiveMutate({ userId, worldId });
  }, [clearActiveMutate, userId, worldId]);

  const isPending =
    (selectableEnabled && selectableQuery.isPending) ||
    (selectableEnabled && activeRowQuery.isPending) ||
    setActivePending ||
    clearActivePending;

  const value = useMemo<ActivePlayerCharacterContextValue>(
    () => ({
      activeCharacter,
      clear,
      isPending,
      selectableCharacters,
      switchTo,
    }),
    [activeCharacter, clear, isPending, selectableCharacters, switchTo],
  );

  return (
    <ActivePlayerCharacterContext value={value}>
      {children}
    </ActivePlayerCharacterContext>
  );
}
