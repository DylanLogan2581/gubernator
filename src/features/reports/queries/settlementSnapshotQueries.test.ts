import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  settlementPopulationSnapshotsQueryOptions,
  settlementResourceSnapshotsQueryOptions,
} from "./settlementSnapshotQueries";

type QueryBuilder = {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly gte: ReturnType<typeof vi.fn>;
  readonly lte: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly returns: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
};

function createBuilder({
  rows,
  error = null,
}: {
  readonly rows: readonly unknown[];
  readonly error?: { readonly code: string; readonly message: string } | null;
}): QueryBuilder {
  const builder: QueryBuilder = {
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    returns: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.returns.mockResolvedValue({ data: rows, error });

  return builder;
}

function createClient(opts: {
  readonly rows: readonly unknown[];
  readonly error?: { readonly code: string; readonly message: string } | null;
}): GubernatorSupabaseClient {
  return createClientWithBuilder(opts).client;
}

function createClientWithBuilder(opts: {
  readonly rows: readonly unknown[];
  readonly error?: { readonly code: string; readonly message: string } | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly builder: QueryBuilder;
  readonly from: ReturnType<typeof vi.fn>;
} {
  const builder = createBuilder(opts);
  const from = vi.fn(() => builder);
  const client = { from } as unknown as GubernatorSupabaseClient;

  return { builder, client, from };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
}

describe("settlementPopulationSnapshotsQueryOptions", () => {
  it("returns rows unchanged (no null-coalescing on this narrower view)", async () => {
    const queryClient = createQueryClient();
    const row = {
      birth_count: 1,
      death_count: 0,
      homeless_deaths_count: 0,
      population_cap: 50,
      population_npc: 8,
      population_player_character: 2,
      population_total: 10,
      starvation_deaths_count: 0,
      turn_number: 3,
    };

    const result = await queryClient.fetchQuery(
      settlementPopulationSnapshotsQueryOptions(
        "settlement-1",
        1,
        10,
        createClient({ rows: [row] }),
      ),
    );

    expect(result).toEqual([row]);
  });

  it("returns empty array for an empty turn range", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      settlementPopulationSnapshotsQueryOptions(
        "settlement-1",
        5,
        5,
        createClient({ rows: [] }),
      ),
    );

    expect(result).toEqual([]);
  });

  it("scopes the query by settlement and turn range", async () => {
    const { builder, client, from } = createClientWithBuilder({ rows: [] });
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      settlementPopulationSnapshotsQueryOptions("settlement-1", 3, 8, client),
    );

    expect(from).toHaveBeenCalledWith("settlement_turn_snapshots");
    expect(builder.eq).toHaveBeenCalledWith("settlement_id", "settlement-1");
    expect(builder.gte).toHaveBeenCalledWith("turn_number", 3);
    expect(builder.lte).toHaveBeenCalledWith("turn_number", 8);
    expect(builder.order).toHaveBeenCalledWith("turn_number", {
      ascending: true,
    });
  });

  it("throws a normalized error when the query fails", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        settlementPopulationSnapshotsQueryOptions(
          "settlement-1",
          1,
          10,
          createClient({
            error: { code: "500", message: "boom" },
            rows: [],
          }),
        ),
      ),
    ).rejects.toBeTruthy();
  });

  it("builds a query key scoped to settlement and turn range", () => {
    const options = settlementPopulationSnapshotsQueryOptions(
      "settlement-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "settlement-snapshots",
      "population",
      "settlement-1",
      1,
      10,
    ]);
  });
});

describe("settlementResourceSnapshotsQueryOptions", () => {
  it("maps resources.name to resource_name and passes amounts through", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      settlementResourceSnapshotsQueryOptions(
        "settlement-1",
        1,
        10,
        createClient({
          rows: [
            {
              adjustment_amount: 1,
              consumed_amount: 5,
              produced_amount: 10,
              quantity_after: 20,
              quantity_before: 15,
              resource_id: "wood",
              resources: { name: "Wood" },
              trade_in_amount: 0,
              trade_out_amount: 0,
              turn_number: 2,
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        adjustment_amount: 1,
        consumed_amount: 5,
        produced_amount: 10,
        quantity_after: 20,
        quantity_before: 15,
        resource_id: "wood",
        resource_name: "Wood",
        trade_in_amount: 0,
        trade_out_amount: 0,
        turn_number: 2,
      },
    ]);
  });

  it("returns empty array for an empty turn range", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      settlementResourceSnapshotsQueryOptions(
        "settlement-1",
        5,
        5,
        createClient({ rows: [] }),
      ),
    );

    expect(result).toEqual([]);
  });

  it("scopes the query by settlement and turn range", async () => {
    const { builder, client, from } = createClientWithBuilder({ rows: [] });
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      settlementResourceSnapshotsQueryOptions("settlement-1", 3, 8, client),
    );

    expect(from).toHaveBeenCalledWith("settlement_turn_resource_snapshots");
    expect(builder.eq).toHaveBeenCalledWith("settlement_id", "settlement-1");
    expect(builder.gte).toHaveBeenCalledWith("turn_number", 3);
    expect(builder.lte).toHaveBeenCalledWith("turn_number", 8);
  });

  it("throws a normalized error when the query fails", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        settlementResourceSnapshotsQueryOptions(
          "settlement-1",
          1,
          10,
          createClient({
            error: { code: "500", message: "boom" },
            rows: [],
          }),
        ),
      ),
    ).rejects.toBeTruthy();
  });

  it("builds a query key scoped to settlement and turn range", () => {
    const options = settlementResourceSnapshotsQueryOptions(
      "settlement-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "settlement-snapshots",
      "resources",
      "settlement-1",
      1,
      10,
    ]);
  });
});
