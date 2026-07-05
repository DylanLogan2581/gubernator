import { useQueries, useQuery } from "@tanstack/react-query";

import {
  settlementBuildingsByNationsQueryOptions,
  settlementBuildingsBySettlementQueryOptions,
  settlementBuildingsByWorldQueryOptions,
} from "@/features/buildings";
import type {
  SettlementBuilding,
  SettlementBuildingWithLocation,
} from "@/features/buildings";
import { settlementsByWorldQueryOptions } from "@/features/settlements";

import type { EventScopeType } from "../types/eventTypes";

/** A single building instance, labeled with its blueprint and settlement name. */
export type BuildingWithLocationInfo = {
  readonly id: string;
  readonly settlementId: string;
  readonly settlementName: string;
  readonly nationName: string;
  readonly blueprintName: string;
  readonly label: string;
  readonly groupLabel: string;
};

type UseBuildingsInScopeParams = {
  readonly worldId: string;
  readonly scopeType: EventScopeType | null;
  readonly selectedIds: readonly string[];
  /** Set false to skip fetching when no consumer needs building data yet. */
  readonly enabled?: boolean;
};

type UseBuildingsInScopeResult = {
  readonly buildings: readonly BuildingWithLocationInfo[];
  readonly isLoading: boolean;
};

/**
 * Pools every building instance within an event's scope (settlement, nation,
 * or world), each labeled "<blueprint name> - <settlement name>[ - <nation name>]"
 * so callers never have to render a raw UUID. Shared by the effects step
 * (instance picker) and the review step (name resolution) so both agree on
 * the exact same scope-derived list.
 */
export function useBuildingsInScope({
  worldId,
  scopeType,
  selectedIds,
  enabled = true,
}: UseBuildingsInScopeParams): UseBuildingsInScopeResult {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const settlementNameById = new Map(
    (settlementsQuery.data ?? []).map((s) => [s.id, s.name]),
  );

  const settlementBuildingQueries = useQueries({
    queries:
      enabled && scopeType === "settlement" && selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            settlementBuildingsBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  const nationBuildingQueryOptions =
    enabled && scopeType === "nation" && selectedIds.length > 0
      ? settlementBuildingsByNationsQueryOptions(selectedIds)
      : null;
  const nationBuildingQuery = useQuery(
    (nationBuildingQueryOptions ?? {
      queryKey: ["buildings", "nations-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly SettlementBuildingWithLocation[]),
      enabled: false,
    }) as never,
  );

  const worldBuildingQueryOptions =
    enabled && scopeType === "world"
      ? settlementBuildingsByWorldQueryOptions(worldId)
      : null;
  const worldBuildingQuery = useQuery(
    (worldBuildingQueryOptions ?? {
      queryKey: ["buildings", "world-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly SettlementBuildingWithLocation[]),
      enabled: false,
    }) as never,
  );

  const buildings: BuildingWithLocationInfo[] = [];
  let isLoading = false;

  if (scopeType === "settlement") {
    isLoading = settlementBuildingQueries.some((q) => q.isLoading === true);
    settlementBuildingQueries.forEach((query, index) => {
      const settlementId = selectedIds[index];
      const rows = query.data as SettlementBuilding[] | undefined;
      if (
        settlementId === undefined ||
        rows === undefined ||
        !Array.isArray(rows)
      ) {
        return;
      }
      const settlementName =
        settlementNameById.get(settlementId) ?? settlementId;
      rows.forEach((building) => {
        buildings.push({
          id: building.id,
          settlementId,
          settlementName,
          nationName: "",
          blueprintName: building.blueprintName,
          label: `${building.blueprintName} (${settlementName})`,
          groupLabel: settlementName,
        });
      });
    });
  } else if (scopeType === "nation") {
    isLoading = nationBuildingQuery.isLoading;
    const rows = nationBuildingQuery.data as
      | SettlementBuildingWithLocation[]
      | undefined;
    if (rows !== undefined && Array.isArray(rows)) {
      rows.forEach((building) => {
        buildings.push({
          id: building.id,
          settlementId: building.settlementId,
          settlementName: building.settlementName,
          nationName: building.nationName,
          blueprintName: building.blueprintName,
          label: `${building.blueprintName} - ${building.settlementName} - ${building.nationName}`,
          groupLabel: building.settlementName,
        });
      });
    }
  } else if (scopeType === "world") {
    isLoading = worldBuildingQuery.isLoading;
    const rows = worldBuildingQuery.data as
      | SettlementBuildingWithLocation[]
      | undefined;
    if (rows !== undefined && Array.isArray(rows)) {
      rows.forEach((building) => {
        buildings.push({
          id: building.id,
          settlementId: building.settlementId,
          settlementName: building.settlementName,
          nationName: building.nationName,
          blueprintName: building.blueprintName,
          label: `${building.blueprintName} - ${building.settlementName} - ${building.nationName}`,
          groupLabel: building.settlementName,
        });
      });
    }
  }

  return { buildings, isLoading };
}
