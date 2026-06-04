import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { managedPopulationsQueryKeys } from "./managedPopulationsQueryKeys";

type SnapshotRow = {
  readonly turn_number: number;
  readonly managed_populations_summary_json: unknown;
};

type SnapshotPopEntry = {
  readonly instanceId: string;
  readonly currentCount: number;
};

function isSnapshotPopEntry(v: unknown): v is SnapshotPopEntry {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.instanceId === "string" && typeof o.currentCount === "number";
}

function parseSnapshotSummary(json: unknown): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  if (!Array.isArray(json)) return result;
  for (const entry of json) {
    if (isSnapshotPopEntry(entry)) {
      result.set(entry.instanceId, entry.currentCount);
    }
  }
  return result;
}

export type ManagedPopSnapshotCounts = {
  readonly latestCounts: ReadonlyMap<string, number> | null;
  readonly prevCounts: ReadonlyMap<string, number> | null;
};

type SnapshotsBySettlementQueryKey = ReturnType<
  typeof managedPopulationsQueryKeys.snapshotsBySettlement
>;

export function managedPopulationSnapshotsBySettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  ManagedPopSnapshotCounts,
  Error,
  ManagedPopSnapshotCounts,
  SnapshotsBySettlementQueryKey
> {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getManagedPopSnapshotsBySettlement(c, settlementId),
    queryKey: managedPopulationsQueryKeys.snapshotsBySettlement(settlementId),
  });
}

async function getManagedPopSnapshotsBySettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<ManagedPopSnapshotCounts> {
  const { data, error } = await client
    .from("settlement_turn_snapshots")
    .select("turn_number,managed_populations_summary_json")
    .eq("settlement_id", settlementId)
    .order("turn_number", { ascending: false })
    .limit(2)
    .returns<SnapshotRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data.length === 0) {
    return { latestCounts: null, prevCounts: null };
  }

  const latestCounts = parseSnapshotSummary(
    data[0].managed_populations_summary_json,
  );
  const prevCounts =
    data.length > 1
      ? parseSnapshotSummary(data[1].managed_populations_summary_json)
      : null;

  return { latestCounts, prevCounts };
}
