/**
 * React Query key factory for events feature.
 */

import type { EventListFilters } from "../types/eventTypes";

export const eventQueryKeys = {
  all: ["events"] as const,
  byWorld: (worldId: string) =>
    [...eventQueryKeys.all, "by-world", worldId] as const,
  list: (worldId: string, filters?: EventListFilters) =>
    [
      ...eventQueryKeys.byWorld(worldId),
      "list",
      JSON.stringify(filters),
    ] as const,
  detail: (worldId: string, eventId: string) =>
    [...eventQueryKeys.byWorld(worldId), "detail", eventId] as const,
  groupDetail: (worldId: string, groupId: string) =>
    [...eventQueryKeys.byWorld(worldId), "group", groupId] as const,
  effectTypes: () => [...eventQueryKeys.all, "effect-types"] as const,
  bySettlement: (worldId: string, settlementId: string) =>
    [...eventQueryKeys.byWorld(worldId), "settlement", settlementId] as const,
  byNation: (worldId: string, nationId: string) =>
    [...eventQueryKeys.byWorld(worldId), "nation", nationId] as const,
} as const;
