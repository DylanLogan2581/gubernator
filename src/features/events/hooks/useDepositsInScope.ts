import { useQueries, useQuery } from "@tanstack/react-query";

import {
  depositInstancesByNationsQueryOptions,
  depositInstancesBySettlementQueryOptions,
  depositInstancesByWorldQueryOptions,
} from "@/features/deposits";
import type {
  DepositInstance,
  DepositInstanceWithLocation,
} from "@/features/deposits";
import { settlementsByWorldQueryOptions } from "@/features/settlements";

import type { EventScopeType } from "../types/eventTypes";

/** A single deposit instance, labeled with its deposit type and settlement name. */
export type DepositWithLocationInfo = {
  readonly id: string;
  readonly settlementId: string;
  readonly settlementName: string;
  readonly nationName: string;
  readonly name: string;
  readonly depositTypeId: string;
  readonly depositTypeName: string;
  readonly label: string;
  readonly groupLabel: string;
};

type UseDepositsInScopeParams = {
  readonly worldId: string;
  readonly scopeType: EventScopeType | null;
  readonly selectedIds: readonly string[];
  /** Set false to skip fetching when no consumer needs deposit data yet. */
  readonly enabled?: boolean;
};

type UseDepositsInScopeResult = {
  readonly deposits: readonly DepositWithLocationInfo[];
  readonly isLoading: boolean;
};

/**
 * Pools every deposit instance within an event's scope (settlement, nation, or
 * world), each labeled "<deposit name> - <settlement name>[ - <nation name>]"
 * so callers never have to render a raw UUID. Shared by the effects step
 * (instance picker, "all of a type" live count) and the review step (name
 * resolution, live count) so both agree on the exact same scope-derived list.
 */
export function useDepositsInScope({
  worldId,
  scopeType,
  selectedIds,
  enabled = true,
}: UseDepositsInScopeParams): UseDepositsInScopeResult {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const settlementNameById = new Map(
    (settlementsQuery.data ?? []).map((s) => [s.id, s.name]),
  );

  const settlementDepositQueries = useQueries({
    queries:
      enabled && scopeType === "settlement" && selectedIds.length > 0
        ? selectedIds.map((settlementId) =>
            depositInstancesBySettlementQueryOptions(settlementId),
          )
        : [],
  });

  const nationDepositQueryOptions =
    enabled && scopeType === "nation" && selectedIds.length > 0
      ? depositInstancesByNationsQueryOptions(selectedIds)
      : null;
  const nationDepositQuery = useQuery(
    (nationDepositQueryOptions ?? {
      queryKey: ["deposits", "nations-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly DepositInstanceWithLocation[]),
      enabled: false,
    }) as never,
  );

  const worldDepositQueryOptions =
    enabled && scopeType === "world"
      ? depositInstancesByWorldQueryOptions(worldId)
      : null;
  const worldDepositQuery = useQuery(
    (worldDepositQueryOptions ?? {
      queryKey: ["deposits", "world-disabled"] as const,
      queryFn: () =>
        Promise.resolve([] as readonly DepositInstanceWithLocation[]),
      enabled: false,
    }) as never,
  );

  const deposits: DepositWithLocationInfo[] = [];
  let isLoading = false;

  if (scopeType === "settlement") {
    isLoading = settlementDepositQueries.some((q) => q.isLoading === true);
    settlementDepositQueries.forEach((query, index) => {
      const settlementId = selectedIds[index];
      const rows = query.data as DepositInstance[] | undefined;
      if (
        settlementId === undefined ||
        rows === undefined ||
        !Array.isArray(rows)
      ) {
        return;
      }
      const settlementName =
        settlementNameById.get(settlementId) ?? settlementId;
      rows.forEach((deposit) => {
        deposits.push({
          id: deposit.id,
          settlementId,
          settlementName,
          nationName: "",
          name: deposit.name,
          depositTypeId: deposit.depositTypeId,
          depositTypeName: deposit.depositTypeName,
          label: `${deposit.name} (${settlementName})`,
          groupLabel: settlementName,
        });
      });
    });
  } else if (scopeType === "nation") {
    isLoading = nationDepositQuery.isLoading;
    const rows = nationDepositQuery.data as
      | DepositInstanceWithLocation[]
      | undefined;
    if (rows !== undefined && Array.isArray(rows)) {
      rows.forEach((deposit) => {
        deposits.push({
          id: deposit.id,
          settlementId: deposit.settlementId,
          settlementName: deposit.settlementName,
          nationName: deposit.nationName,
          name: deposit.name,
          depositTypeId: deposit.depositTypeId,
          depositTypeName: deposit.depositTypeName,
          label: `${deposit.name} - ${deposit.settlementName} - ${deposit.nationName}`,
          groupLabel: deposit.settlementName,
        });
      });
    }
  } else if (scopeType === "world") {
    isLoading = worldDepositQuery.isLoading;
    const rows = worldDepositQuery.data as
      | DepositInstanceWithLocation[]
      | undefined;
    if (rows !== undefined && Array.isArray(rows)) {
      rows.forEach((deposit) => {
        deposits.push({
          id: deposit.id,
          settlementId: deposit.settlementId,
          settlementName: deposit.settlementName,
          nationName: deposit.nationName,
          name: deposit.name,
          depositTypeId: deposit.depositTypeId,
          depositTypeName: deposit.depositTypeName,
          label: `${deposit.name} - ${deposit.settlementName} - ${deposit.nationName}`,
          groupLabel: deposit.settlementName,
        });
      });
    }
  }

  return { deposits, isLoading };
}
