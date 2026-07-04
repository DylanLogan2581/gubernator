import { createContext, use } from "react";

import type { Citizen } from "@/features/citizens";

export type ActivePlayerCharacterContextValue = {
  readonly activeCharacter: Citizen | null;
  readonly clear: () => void;
  // Optional so existing fixtures/mocks across the codebase that build this
  // value by hand don't all need updating for a flag only WorldEntryGate's
  // auto-select guard reads. Defaults to false (no explicit choice made).
  readonly isExplicitAdminChoice?: boolean;
  readonly isPending: boolean;
  readonly selectableCharacters: readonly Citizen[];
  readonly switchTo: (citizenId: string) => void;
};

const EMPTY_VALUE: ActivePlayerCharacterContextValue = {
  activeCharacter: null,
  clear: noop,
  isExplicitAdminChoice: false,
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
