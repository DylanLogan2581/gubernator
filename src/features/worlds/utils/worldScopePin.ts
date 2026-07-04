import {
  readLocalStorageItem,
  writeLocalStorageItem,
} from "@/lib/localStorage";

import type { WorldScopePin } from "./resolveWorldScope";

// Persists the last-viewed SETTLEMENT/NATION scope per world (docs/ui-
// redesign.md §3.2: "no server-side visit tracking, decided"). Scoped by
// world only, not by user — unlike explicitAdminChoice.ts, there's no
// per-account intent to protect here, just a browser-local "where was I"
// bookmark.
const STORAGE_KEY_PREFIX = "gubernator:world-scope-pin";
const EMPTY_PIN: WorldScopePin = { nationId: null, settlementId: null };

function storageKey(worldId: string): string {
  return `${STORAGE_KEY_PREFIX}:${worldId}`;
}

export function readWorldScopePin(worldId: string): WorldScopePin {
  const raw = readLocalStorageItem(storageKey(worldId));
  if (raw === null) {
    return EMPTY_PIN;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return EMPTY_PIN;
    }
    const { nationId, settlementId } = parsed as Record<string, unknown>;
    return {
      nationId: typeof nationId === "string" ? nationId : null,
      settlementId: typeof settlementId === "string" ? settlementId : null,
    };
  } catch {
    return EMPTY_PIN;
  }
}

export function writeWorldScopePin(worldId: string, pin: WorldScopePin): void {
  writeLocalStorageItem(storageKey(worldId), JSON.stringify(pin));
}
