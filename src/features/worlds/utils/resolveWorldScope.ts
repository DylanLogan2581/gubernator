export type WorldScopePin = {
  readonly nationId: string | null;
  readonly settlementId: string | null;
};

export type ResolveWorldScopeInput = {
  readonly activeCharacterSettlementId: string | null;
  readonly routeNationId: string | null;
  readonly routeSettlementId: string | null;
  readonly storedPin: WorldScopePin;
};

// Priority order (docs/ui-redesign.md §3.2): current route params -> last-
// viewed scope for this world (storedPin, read from localStorage by the
// caller) -> active character's home settlement. Nation and settlement each
// resolve independently through the same tiers. Resolving a nation from the
// home-settlement tier requires an extra settlement lookup (its nation_id)
// that this pure function can't perform — callers query that separately
// when nationId comes back null but settlementId doesn't.
export function resolveWorldScope({
  activeCharacterSettlementId,
  routeNationId,
  routeSettlementId,
  storedPin,
}: ResolveWorldScopeInput): WorldScopePin {
  return {
    nationId: routeNationId ?? storedPin.nationId,
    settlementId:
      routeSettlementId ??
      storedPin.settlementId ??
      activeCharacterSettlementId,
  };
}
