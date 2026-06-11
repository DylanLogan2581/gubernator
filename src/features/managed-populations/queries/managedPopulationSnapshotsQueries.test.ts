import { QueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  managedPopulationSnapshotsBySettlementQueryOptions,
  type ManagedPopSnapshotCounts,
} from "./managedPopulationSnapshotsQueries";

import type { managedPopulationsQueryKeys } from "./managedPopulationsQueryKeys";

describe("managedPopulationSnapshotsBySettlementQueryOptions", () => {
  it("error type is Error, not AuthUiError", () => {
    // worldScopedQueryOptions hardcodes Error; verify the annotation matches.
    type SnapshotsBySettlementKey = ReturnType<
      typeof managedPopulationsQueryKeys.snapshotsBySettlement
    >;
    type OptionsType = UseQueryOptions<
      ManagedPopSnapshotCounts,
      Error,
      ManagedPopSnapshotCounts,
      SnapshotsBySettlementKey
    >;
    expectTypeOf(
      managedPopulationSnapshotsBySettlementQueryOptions,
    ).returns.toMatchTypeOf<OptionsType>();
  });

  it("returns null counts when no snapshots exist", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      managedPopulationSnapshotsBySettlementQueryOptions(
        "settlement-1",
        createClient({ rows: [] }),
      ),
    );

    expect(result).toEqual({ latestCounts: null, prevCounts: null });
  });

  it("returns latestCounts and null prevCounts for one snapshot", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      managedPopulationSnapshotsBySettlementQueryOptions(
        "settlement-1",
        createClient({
          rows: [
            {
              turn_number: 3,
              managed_populations_summary_json: [
                { instanceId: "inst-1", currentCount: 42 },
              ],
            },
          ],
        }),
      ),
    );

    expect(result.latestCounts).toEqual(new Map([["inst-1", 42]]));
    expect(result.prevCounts).toBeNull();
  });

  it("returns both latestCounts and prevCounts for two snapshots", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      managedPopulationSnapshotsBySettlementQueryOptions(
        "settlement-1",
        createClient({
          rows: [
            {
              turn_number: 4,
              managed_populations_summary_json: [
                { instanceId: "inst-1", currentCount: 50 },
              ],
            },
            {
              turn_number: 3,
              managed_populations_summary_json: [
                { instanceId: "inst-1", currentCount: 42 },
              ],
            },
          ],
        }),
      ),
    );

    expect(result.latestCounts).toEqual(new Map([["inst-1", 50]]));
    expect(result.prevCounts).toEqual(new Map([["inst-1", 42]]));
  });

  it("uses settlement-scoped query key", () => {
    const options = managedPopulationSnapshotsBySettlementQueryOptions(
      "settlement-abc",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toContain("settlement-abc");
  });
});

type SnapshotRow = {
  readonly turn_number: number;
  readonly managed_populations_summary_json: unknown;
};

function createClient({
  rows,
  error = null,
}: {
  readonly rows: readonly SnapshotRow[];
  readonly error?: { readonly code: string; readonly message: string } | null;
}): GubernatorSupabaseClient {
  const builder = {
    eq: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
    returns: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.returns.mockResolvedValue({ data: rows, error });

  return { from: vi.fn(() => builder) } as unknown as GubernatorSupabaseClient;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
}
