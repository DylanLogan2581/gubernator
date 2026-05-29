import { createContext, use } from "react";

import type { Citizen } from "@/features/citizens";

export type ActivePlayerCharacterContextValue = {
  readonly activeCharacter: Citizen | null;
  readonly clear: () => void;
  readonly isPending: boolean;
  readonly selectableCharacters: readonly Citizen[];
  readonly switchTo: (citizenId: string) => void;
};

const EMPTY_VALUE: ActivePlayerCharacterContextValue = {
  activeCharacter: null,
  clear: noop,
  isPending: false,
  selectableCharacters: [],
  switchTo: noop,
};

export const ActivePlayerCharacterContext =
  createContext<ActivePlayerCharacterContextValue | null>(null);

export function useActivePlayerCharacter(): ActivePlayerCharacterContextValue {
  const value = use(ActivePlayerCharacterContext);
  return value ?? EMPTY_VALUE;
}

function noop(): void {}
