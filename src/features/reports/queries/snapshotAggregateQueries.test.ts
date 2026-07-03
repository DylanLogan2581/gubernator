import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  nationPopulationAggregatesQueryOptions,
  nationResourceAggregatesQueryOptions,
  nationSettlementSnapshotsQueryOptions,
  worldNationsPopulationQueryOptions,
  worldPopulationAggregatesQueryOptions,
  worldResourceAggregatesQueryOptions,
} from "./snapshotAggregateQueries";

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

describe("nationPopulationAggregatesQueryOptions", () => {
  it("defaults nullable numeric fields to 0 and keeps required fields", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      nationPopulationAggregatesQueryOptions(
        "nation-1",
        1,
        10,
        createClient({
          rows: [
            {
              birth_count: null,
              death_count: null,
              homeless_deaths_count: null,
              population_cap: null,
              population_npc: null,
              population_player_character: null,
              population_total: 100,
              starvation_deaths_count: null,
              turn_number: 5,
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        birth_count: 0,
        death_count: 0,
        homeless_deaths_count: 0,
        population_cap: 0,
        population_npc: 0,
        population_player_character: 0,
        population_total: 100,
        starvation_deaths_count: 0,
        turn_number: 5,
      },
    ]);
  });

  it("drops rows with a null turn_number or null population_total (gaps/missing turns)", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      nationPopulationAggregatesQueryOptions(
        "nation-1",
        1,
        10,
        createClient({
          rows: [
            { population_total: 100, turn_number: null },
            { population_total: null, turn_number: 2 },
            { population_total: 200, turn_number: 3 },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      expect.objectContaining({ population_total: 200, turn_number: 3 }),
    ]);
  });

  it("returns empty array for an empty turn range", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      nationPopulationAggregatesQueryOptions(
        "nation-1",
        5,
        5,
        createClient({ rows: [] }),
      ),
    );

    expect(result).toEqual([]);
  });

  it("scopes the query by nation and turn range", async () => {
    const { builder, client, from } = createClientWithBuilder({ rows: [] });
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      nationPopulationAggregatesQueryOptions("nation-1", 3, 8, client),
    );

    expect(from).toHaveBeenCalledWith("nation_turn_population_aggregates");
    expect(builder.eq).toHaveBeenCalledWith("nation_id", "nation-1");
    expect(builder.gte).toHaveBeenCalledWith("turn_number", 3);
    expect(builder.lte).toHaveBeenCalledWith("turn_number", 8);
  });

  it("throws a normalized error when the query fails", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        nationPopulationAggregatesQueryOptions(
          "nation-1",
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

  it("builds a query key scoped to nation and turn range", () => {
    const options = nationPopulationAggregatesQueryOptions(
      "nation-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "snapshot-aggregates",
      "nation-population",
      "nation-1",
      1,
      10,
    ]);
  });
});

describe("nationResourceAggregatesQueryOptions", () => {
  it("defaults nullable numeric fields to 0", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      nationResourceAggregatesQueryOptions(
        "nation-1",
        1,
        10,
        createClient({
          rows: [
            {
              consumed_amount: null,
              net_amount: null,
              produced_amount: null,
              resource_id: "wood",
              resource_name: "Wood",
              trade_in_amount: null,
              trade_out_amount: null,
              turn_number: 1,
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        consumed_amount: 0,
        net_amount: 0,
        produced_amount: 0,
        resource_id: "wood",
        resource_name: "Wood",
        trade_in_amount: 0,
        trade_out_amount: 0,
        turn_number: 1,
      },
    ]);
  });

  it("drops rows missing turn_number, resource_id, or resource_name", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      nationResourceAggregatesQueryOptions(
        "nation-1",
        1,
        10,
        createClient({
          rows: [
            { resource_id: "wood", resource_name: "Wood", turn_number: null },
            { resource_id: null, resource_name: "Wood", turn_number: 1 },
            { resource_id: "wood", resource_name: null, turn_number: 1 },
            { resource_id: "ore", resource_name: "Ore", turn_number: 2 },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      expect.objectContaining({ resource_id: "ore", turn_number: 2 }),
    ]);
  });

  it("builds a query key scoped to nation and turn range", () => {
    const options = nationResourceAggregatesQueryOptions(
      "nation-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "snapshot-aggregates",
      "nation-resources",
      "nation-1",
      1,
      10,
    ]);
  });
});

describe("nationSettlementSnapshotsQueryOptions", () => {
  it("maps settlements.name to settlement_name and passes required fields through", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      nationSettlementSnapshotsQueryOptions(
        "nation-1",
        1,
        10,
        createClient({
          rows: [
            {
              birth_count: 1,
              death_count: 0,
              homeless_deaths_count: 0,
              population_cap: 50,
              population_npc: 10,
              population_player_character: 2,
              population_total: 12,
              settlement_id: "settlement-1",
              settlements: { name: "Riverside" },
              starvation_deaths_count: 0,
              turn_number: 4,
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        birth_count: 1,
        death_count: 0,
        homeless_deaths_count: 0,
        population_cap: 50,
        population_npc: 10,
        population_player_character: 2,
        population_total: 12,
        settlement_id: "settlement-1",
        settlement_name: "Riverside",
        starvation_deaths_count: 0,
        turn_number: 4,
      },
    ]);
  });

  it("returns empty array for an empty turn range", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      nationSettlementSnapshotsQueryOptions(
        "nation-1",
        5,
        5,
        createClient({ rows: [] }),
      ),
    );

    expect(result).toEqual([]);
  });

  it("scopes by the settlement's nation_id via the settlements join", async () => {
    const { builder, client, from } = createClientWithBuilder({ rows: [] });
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      nationSettlementSnapshotsQueryOptions("nation-1", 3, 8, client),
    );

    expect(from).toHaveBeenCalledWith("settlement_turn_snapshots");
    expect(builder.eq).toHaveBeenCalledWith(
      "settlements.nation_id",
      "nation-1",
    );
  });

  it("builds a query key scoped to nation and turn range", () => {
    const options = nationSettlementSnapshotsQueryOptions(
      "nation-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "snapshot-aggregates",
      "nation-settlements",
      "nation-1",
      1,
      10,
    ]);
  });
});

describe("worldPopulationAggregatesQueryOptions", () => {
  it("defaults nullable numeric fields to 0 and drops gap rows", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      worldPopulationAggregatesQueryOptions(
        "world-1",
        1,
        10,
        createClient({
          rows: [
            { population_total: null, turn_number: 2 },
            {
              birth_count: null,
              death_count: null,
              homeless_deaths_count: null,
              population_cap: null,
              population_npc: null,
              population_player_character: null,
              population_total: 300,
              starvation_deaths_count: null,
              turn_number: 3,
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        birth_count: 0,
        death_count: 0,
        homeless_deaths_count: 0,
        population_cap: 0,
        population_npc: 0,
        population_player_character: 0,
        population_total: 300,
        starvation_deaths_count: 0,
        turn_number: 3,
      },
    ]);
  });

  it("builds a query key scoped to world and turn range", () => {
    const options = worldPopulationAggregatesQueryOptions(
      "world-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "snapshot-aggregates",
      "world-population",
      "world-1",
      1,
      10,
    ]);
  });
});

describe("worldResourceAggregatesQueryOptions", () => {
  it("defaults nullable numeric fields to 0", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      worldResourceAggregatesQueryOptions(
        "world-1",
        1,
        10,
        createClient({
          rows: [
            {
              consumed_amount: null,
              net_amount: null,
              produced_amount: null,
              resource_id: "wood",
              resource_name: "Wood",
              trade_in_amount: null,
              trade_out_amount: null,
              turn_number: 1,
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        consumed_amount: 0,
        net_amount: 0,
        produced_amount: 0,
        resource_id: "wood",
        resource_name: "Wood",
        trade_in_amount: 0,
        trade_out_amount: 0,
        turn_number: 1,
      },
    ]);
  });

  it("builds a query key scoped to world and turn range", () => {
    const options = worldResourceAggregatesQueryOptions(
      "world-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "snapshot-aggregates",
      "world-resources",
      "world-1",
      1,
      10,
    ]);
  });
});

describe("worldNationsPopulationQueryOptions", () => {
  it("keeps nation_id and defaults nullable numeric fields to 0", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      worldNationsPopulationQueryOptions(
        "world-1",
        1,
        10,
        createClient({
          rows: [
            {
              birth_count: null,
              death_count: null,
              homeless_deaths_count: null,
              nation_id: "nation-1",
              population_cap: null,
              population_npc: null,
              population_player_character: null,
              population_total: 400,
              starvation_deaths_count: null,
              turn_number: 6,
            },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      {
        birth_count: 0,
        death_count: 0,
        homeless_deaths_count: 0,
        nation_id: "nation-1",
        population_cap: 0,
        population_npc: 0,
        population_player_character: 0,
        population_total: 400,
        starvation_deaths_count: 0,
        turn_number: 6,
      },
    ]);
  });

  it("drops rows missing turn_number, nation_id, or population_total", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      worldNationsPopulationQueryOptions(
        "world-1",
        1,
        10,
        createClient({
          rows: [
            { nation_id: "nation-1", population_total: 1, turn_number: null },
            { nation_id: null, population_total: 1, turn_number: 1 },
            { nation_id: "nation-1", population_total: null, turn_number: 1 },
            { nation_id: "nation-2", population_total: 2, turn_number: 2 },
          ],
        }),
      ),
    );

    expect(result).toEqual([
      expect.objectContaining({ nation_id: "nation-2", turn_number: 2 }),
    ]);
  });

  it("builds a query key scoped to world and turn range", () => {
    const options = worldNationsPopulationQueryOptions(
      "world-1",
      1,
      10,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "snapshot-aggregates",
      "world-nations-population",
      "world-1",
      1,
      10,
    ]);
  });
});
