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

export type NextWorldScopePinInput = {
  readonly routeNationId: string | null;
  readonly routeSettlementId: string | null;
  readonly storedPin: WorldScopePin;
};

// Folds a route change into the persisted pin (docs/ui-redesign.md §3.2).
// A settlement only ever belongs to one nation, so carrying the old
// settlementId forward across a bare nation-scope change (no settlementId in
// the new route) would pair it with a nation it doesn't belong to -- the
// sidebar's SETTLEMENT links would then mix ids across nations. When the
// route supplies a new nationId without a settlementId, the stored
// settlement is cleared instead of carried over, dropping the SETTLEMENT
// group back to its "choose a settlement" state until a settlement under
// the new nation is actually visited.
export function nextWorldScopePin({
  routeNationId,
  routeSettlementId,
  storedPin,
}: NextWorldScopePinInput): WorldScopePin {
  if (routeNationId === null && routeSettlementId === null) {
    return storedPin;
  }

  const nationChanged =
    routeNationId !== null && routeNationId !== storedPin.nationId;

  return {
    nationId: routeNationId ?? storedPin.nationId,
    settlementId:
      routeSettlementId ?? (nationChanged ? null : storedPin.settlementId),
  };
}
