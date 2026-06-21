import { useActivePlayerCharacter } from "../context/activePlayerCharacterContext";

/**
 * Returns whether the current viewer has effective admin authority.
 *
 * When an active player character is selected the viewer is acting in player
 * mode, so account-level admin privileges are suppressed to match the active
 * role. Clearing the active character restores full admin access.
 *
 * True player accounts (no `canAdmin`) are unaffected — they continue to be
 * restricted as before.
 */
export function useEffectiveCanAdmin(canAdmin: boolean): boolean {
  const { activeCharacter } = useActivePlayerCharacter();
  return canAdmin && activeCharacter === null;
}
