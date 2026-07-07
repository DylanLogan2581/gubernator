import { createContext, use } from "react";

import type {
  WorldPermissionContext,
  WorldRouteAccess,
} from "@/features/worlds";

import type { SettlementWithNation } from "../../types/settlementTypes";

export type SettlementDetailContextValue = {
  readonly accessContext: WorldPermissionContext;
  readonly canDelete: boolean;
  readonly canEditCoordinates: boolean;
  readonly canEditDetails: boolean;
  readonly canManageNation: boolean;
  readonly canManageSettlement: boolean;
  readonly effectiveCanAdmin: boolean;
  readonly isArchived: boolean;
  readonly settlement: SettlementWithNation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
};

export const SettlementDetailContext =
  createContext<SettlementDetailContextValue | null>(null);

// Unlike WorldScopeContext/ActivePlayerCharacterContext (which have safe
// "nothing selected yet" defaults), this context backs data that is always
// mandatory by the time a settlement section route renders — the gating
// pyramid in SettlementDetailPage only mounts the provider (and its
// children/Outlet) once settlement + world access have resolved. A missing
// provider here means a section route was rendered outside the settlement
// detail route tree, which is a bug, not a normal empty state.
export function useSettlementDetailContext(): SettlementDetailContextValue {
  const value = use(SettlementDetailContext);
  if (value === null) {
    throw new Error(
      "useSettlementDetailContext must be used within the settlement detail route tree",
    );
  }
  return value;
}
