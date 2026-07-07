import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from "@/lib/localStorage";

// Persists the last world the viewer visited so world-less routes
// (Notifications, Superadmin) can render a sticky in-world sidebar instead
// of collapsing to the reduced out-of-world nav (docs feature: sticky
// last-world sidebar context). Unlike worldScopePin.ts, this is a single
// account-wide "where was I" bookmark, not scoped per world.
const STORAGE_KEY = "gubernator:last-world";

export function readLastWorldPin(): string | null {
  return readLocalStorageItem(STORAGE_KEY);
}

export function writeLastWorldPin(worldId: string): void {
  writeLocalStorageItem(STORAGE_KEY, worldId);
}

export function clearLastWorldPin(): void {
  removeLocalStorageItem(STORAGE_KEY);
}
