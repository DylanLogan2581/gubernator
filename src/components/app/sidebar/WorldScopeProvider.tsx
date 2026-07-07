import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { useActivePlayerCharacter } from "@/features/permissions";
import { settlementByIdQueryOptions } from "@/features/settlements";
import {
  readWorldScopePin,
  resolveWorldScope,
  writeWorldScopePin,
  type WorldScopePin,
} from "@/features/worlds";

import {
  WorldScopeContext,
  type WorldScopeContextValue,
} from "./WorldScopeContext";

import type { JSX, ReactNode } from "react";

export type WorldScopeProviderProps = {
  readonly children: ReactNode;
  readonly worldId: string;
};

type ScopeKey = {
  readonly routeNationId: string | null;
  readonly routeSettlementId: string | null;
  readonly worldId: string;
};

// Resolves the sidebar's pinned SETTLEMENT/NATION scope (docs/ui-redesign.md
// §3.2) and persists the last-viewed pair to localStorage whenever route
// params supply a fresh value — this is what makes "switch scope from the
// group label -> navigate -> pin updates" work without an imperative
// setter: the switchers are plain <Link>s, and navigating changes the route
// params.
//
// The persistence runs as a during-render state adjustment (React's
// documented "adjusting state when a prop changes" pattern — same shape as
// ActivePlayerCharacterProvider's explicitAdminChoiceKey) rather than an
// effect, so a route change is reflected in the same commit instead of an
// extra render.
export function WorldScopeProvider({
  children,
  worldId,
}: WorldScopeProviderProps): JSX.Element {
  const routeParams = useParams({ strict: false });
  const routeNationId = routeParams.nationId ?? null;
  const routeSettlementId = routeParams.settlementId ?? null;
  const { activeCharacter } = useActivePlayerCharacter();

  const [scopeKey, setScopeKey] = useState<ScopeKey>({
    routeNationId,
    routeSettlementId,
    worldId,
  });
  const [storedPin, setStoredPin] = useState<WorldScopePin>(() =>
    readWorldScopePin(worldId),
  );

  if (
    scopeKey.worldId !== worldId ||
    scopeKey.routeNationId !== routeNationId ||
    scopeKey.routeSettlementId !== routeSettlementId
  ) {
    const isWorldChange = scopeKey.worldId !== worldId;
    setScopeKey({ routeNationId, routeSettlementId, worldId });

    if (isWorldChange) {
      setStoredPin(readWorldScopePin(worldId));
    } else if (routeNationId !== null || routeSettlementId !== null) {
      const next: WorldScopePin = {
        nationId: routeNationId ?? storedPin.nationId,
        settlementId: routeSettlementId ?? storedPin.settlementId,
      };
      if (
        next.nationId !== storedPin.nationId ||
        next.settlementId !== storedPin.settlementId
      ) {
        writeWorldScopePin(worldId, next);
        setStoredPin(next);
      }
    }
  }

  const resolved = resolveWorldScope({
    activeCharacterSettlementId: activeCharacter?.settlementId ?? null,
    routeNationId,
    routeSettlementId,
    storedPin,
  });

  // The nation's last-resort tier (active character's home settlement)
  // isn't known synchronously — it requires looking up that settlement's
  // nation_id, which we only need when the sync tiers left nationId empty.
  const nationLookupEnabled =
    resolved.nationId === null && resolved.settlementId !== null;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(resolved.settlementId ?? ""),
    enabled: nationLookupEnabled,
  });
  const nationId = resolved.nationId ?? settlementQuery.data?.nationId ?? null;
  const settlementId = resolved.settlementId;

  const value = useMemo<WorldScopeContextValue>(
    () => ({
      isPending: nationLookupEnabled && settlementQuery.isPending,
      nationId,
      settlementId,
    }),
    [nationId, nationLookupEnabled, settlementQuery.isPending, settlementId],
  );

  return <WorldScopeContext value={value}>{children}</WorldScopeContext>;
}
