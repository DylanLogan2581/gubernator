import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from "@/lib/localStorage";

// Persists a per-(user, world) flag marking that the viewer deliberately
// chose Admin mode (cleared their active player character on purpose).
// Without this, auto-select races the clear: deleting the active-PC row
// leaves exactly one selectable PC with no active row, and
// useAutoSelectSinglePlayerCharacter immediately re-selects it, permanently
// suppressing admin access for single-PC admins. This is intentionally
// client-only (localStorage), not a DB column: the intent only needs to
// survive this device/session, and avoiding a migration keeps the fix small.
const STORAGE_KEY_PREFIX = "gubernator:explicit-admin-choice";

function storageKey(userId: string, worldId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}:${worldId}`;
}

export function readExplicitAdminChoice(
  userId: string,
  worldId: string,
): boolean {
  return readLocalStorageItem(storageKey(userId, worldId)) === "1";
}

export function writeExplicitAdminChoice(
  userId: string,
  worldId: string,
  value: boolean,
): void {
  if (value) {
    writeLocalStorageItem(storageKey(userId, worldId), "1");
  } else {
    removeLocalStorageItem(storageKey(userId, worldId));
  }
}
