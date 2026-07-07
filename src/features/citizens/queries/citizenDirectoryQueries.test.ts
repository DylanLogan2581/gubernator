import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { citizensDirectoryQueryOptions } from "./citizenDirectoryQueries";

type ResolvedValue = {
  readonly data: readonly unknown[];
  readonly error: unknown;
  readonly count: number | null;
};

function buildClient(resolvedValue: ResolvedValue): {
  client: GubernatorSupabaseClient;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
} {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.eq = vi.fn(() => builder);
  builder.ilike = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.range = vi.fn(() => builder);
  builder.returns = vi.fn(() => Promise.resolve(resolvedValue));
  const select = vi.fn(() => builder);
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    select,
    eq: builder.eq,
    ilike: builder.ilike,
    order: builder.order,
    range: builder.range,
  };
}

function fetch(
  client: GubernatorSupabaseClient,
  worldId: string,
  filters: Parameters<typeof citizensDirectoryQueryOptions>[1],
  pagination: Parameters<typeof citizensDirectoryQueryOptions>[2],
): ReturnType<QueryClient["fetchQuery"]> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return queryClient.fetchQuery(
    citizensDirectoryQueryOptions(worldId, filters, pagination, client),
  );
}

describe("citizensDirectoryQueryOptions", () => {
  it("scopes to world_id and requests an exact count from citizen_directory_view", async () => {
    const { client, select } = buildClient({ data: [], error: null, count: 0 });

    await fetch(client, "world-1", {}, { pageIndex: 0, pageSize: 25 });

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("assignment_label"),
      { count: "exact" },
    );
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("office_types"),
      { count: "exact" },
    );
  });

  it("applies only the filters that are provided", async () => {
    const { client, eq, ilike } = buildClient({
      data: [],
      error: null,
      count: 0,
    });

    await fetch(
      client,
      "world-1",
      {
        citizenType: "npc",
        nationId: "nation-1",
        search: "  ada  ",
        settlementId: "settlement-1",
        status: "alive",
      },
      { pageIndex: 0, pageSize: 25 },
    );

    expect(eq).toHaveBeenCalledWith("world_id", "world-1");
    expect(eq).toHaveBeenCalledWith("settlement_id", "settlement-1");
    expect(eq).toHaveBeenCalledWith("nation_id", "nation-1");
    expect(eq).toHaveBeenCalledWith("citizen_type", "npc");
    expect(eq).toHaveBeenCalledWith("status", "alive");
    expect(ilike).toHaveBeenCalledWith("name", "%ada%");
  });

  it("skips settlement/nation/type/status/search filters when undefined", async () => {
    const { client, eq, ilike } = buildClient({
      data: [],
      error: null,
      count: 0,
    });

    await fetch(client, "world-1", {}, { pageIndex: 0, pageSize: 25 });

    expect(eq).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("world_id", "world-1");
    expect(ilike).not.toHaveBeenCalled();
  });

  it("computes the range from pageIndex and pageSize", async () => {
    const { client, range } = buildClient({
      data: [],
      error: null,
      count: 0,
    });

    await fetch(client, "world-1", {}, { pageIndex: 2, pageSize: 25 });

    expect(range).toHaveBeenCalledWith(50, 74);
  });

  it("defaults to ordering by name ascending when no order is given", async () => {
    const { client, order } = buildClient({ data: [], error: null, count: 0 });

    await fetch(client, "world-1", {}, { pageIndex: 0, pageSize: 25 });

    expect(order).toHaveBeenCalledWith("name", { ascending: true });
    expect(order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("orders by the given column and direction, with id as a tiebreaker", async () => {
    const { client, order } = buildClient({ data: [], error: null, count: 0 });

    await fetch(
      client,
      "world-1",
      { order: { ascending: false, column: "settlement_name" } },
      { pageIndex: 0, pageSize: 25 },
    );

    expect(order).toHaveBeenCalledWith("settlement_name", {
      ascending: false,
    });
    expect(order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("maps snake_case rows to a camelCase CitizenDirectoryRow and returns totalCount", async () => {
    const { client } = buildClient({
      data: [
        {
          age_turns: 7,
          assignment_label: "Blacksmith",
          citizen_type: "npc",
          id: "citizen-1",
          name: "Ada",
          nation_id: "nation-1",
          nation_name: "Nation A",
          office_types: "treasurer",
          settlement_id: "settlement-1",
          settlement_name: "Settlement A",
          sex: "female",
          status: "alive",
        },
      ],
      error: null,
      count: 42,
    });

    const page = await fetch(
      client,
      "world-1",
      {},
      { pageIndex: 0, pageSize: 25 },
    );

    expect(page).toEqual({
      rows: [
        {
          ageTurns: 7,
          assignmentLabel: "Blacksmith",
          citizenType: "npc",
          id: "citizen-1",
          name: "Ada",
          nationId: "nation-1",
          nationName: "Nation A",
          officeTypes: "treasurer",
          settlementId: "settlement-1",
          settlementName: "Settlement A",
          sex: "female",
          status: "alive",
        },
      ],
      totalCount: 42,
    });
  });

  it("throws a normalized error when the query fails", async () => {
    const { client } = buildClient({
      data: [],
      error: { code: "500", message: "boom" },
      count: null,
    });

    await expect(
      fetch(client, "world-1", {}, { pageIndex: 0, pageSize: 25 }),
    ).rejects.toBeTruthy();
  });
});
