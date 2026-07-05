import { createContext, use } from "react";

import type {
  WorldPermissionContext,
  WorldRouteAccess,
} from "@/features/worlds";

import type { Nation } from "../../types/nationTypes";

export type NationDetailContextValue = {
  readonly accessContext: WorldPermissionContext;
  readonly canDelete: boolean;
  readonly canEditDetails: boolean;
  readonly canToggleHidden: boolean;
  readonly effectiveCanAdmin: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
  readonly worldAccess: WorldRouteAccess;
  readonly worldId: string;
};

export const NationDetailContext =
  createContext<NationDetailContextValue | null>(null);

// Mirrors SettlementDetailContext: this backs data that is always mandatory
// by the time a nation section route renders — the gating pyramid in
// NationDetailPage only mounts the provider (and its children/Outlet) once
// the nation + world access have resolved. A missing provider means a
// section route was rendered outside the nation detail route tree, which is
// a bug, not a normal empty state.
export function useNationDetailContext(): NationDetailContextValue {
  const value = use(NationDetailContext);
  if (value === null) {
    throw new Error(
      "useNationDetailContext must be used within the nation detail route tree",
    );
  }
  return value;
}
