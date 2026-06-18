import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  turnLogBrowserQueryOptions,
} from "./turnLogBrowserQueries";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("turnLogBrowserQueryOptions", () => {
  it("maps settlement and nation names from embedded joins", async () => {
    const queryClient = createQueryClient();
    requireSupabaseClient.mockReturnValue(
      createClient({
        rows: [
          createRow({
            id: "entry-1",
            settlement_id: "s-1",
            nation_id: "n-1",
            citizen_id: null,
            settlements: { name: "Ironhaven", nation_id: "n-1" },
            nations: { name: "Valoria" },
          }),
        ],
        count: 1,
      }),
    );

    const page = await queryClient.fetchQuery(
      turnLogBrowserQueryOptions({ filter: {}, page: 0, worldId: "world-1" }),
    );

    const entry = page.entries[0];
    expect(entry.settlementName).toBe("Ironhaven");
    expect(entry.nationName).toBe("Valoria");
    expect(entry.settlementNationId).toBe("n-1");
  });

  it("falls back to null names when embedded joins return null", async () => {
    const queryClient = createQueryClient();
    requireSupabaseClient.mockReturnValue(
      createClient({
        rows: [
          createRow({
            id: "entry-2",
            settlement_id: null,
            nation_id: null,
            citizen_id: null,
            settlements: null,
            nations: null,
          }),
        ],
        count: 1,
      }),
    );

    const page = await queryClient.fetchQuery(
      turnLogBrowserQueryOptions({ filter: {}, page: 0, worldId: "world-1" }),
    );

    const entry = page.entries[0];
    expect(entry.settlementName).toBeNull();
    expect(entry.nationName).toBeNull();
    expect(entry.settlementNationId).toBeNull();
  });

  it("carries settlementNationId from settlement join when log entry nation_id is null", async () => {
    const queryClient = createQueryClient();
    requireSupabaseClient.mockReturnValue(
      createClient({
        rows: [
          createRow({
            id: "entry-3",
            settlement_id: "s-2",
            nation_id: null,
            citizen_id: null,
            settlements: { name: "Dustmere", nation_id: "n-99" },
            nations: null,
          }),
        ],
        count: 1,
      }),
    );

    const page = await queryClient.fetchQuery(
      turnLogBrowserQueryOptions({ filter: {}, page: 0, worldId: "world-1" }),
    );

    const entry = page.entries[0];
    expect(entry.settlementName).toBe("Dustmere");
    expect(entry.nationName).toBeNull();
    expect(entry.nationId).toBeNull();
    expect(entry.settlementNationId).toBe("n-99");
  });

  it("returns total count and paginates entries", async () => {
    const queryClient = createQueryClient();
    requireSupabaseClient.mockReturnValue(
      createClient({ rows: [createRow({ id: "entry-4" })], count: 42 }),
    );

    const page = await queryClient.fetchQuery(
      turnLogBrowserQueryOptions({ filter: {}, page: 0, worldId: "world-1" }),
    );

    expect(page.totalCount).toBe(42);
    expect(page.entries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TestRow = {
  readonly citizen_id: string | null;
  readonly id: string;
  readonly log_category: string;
  readonly nation_id: string | null;
  readonly nations: { readonly name: string } | null;
  readonly payload_jsonb: unknown;
  readonly resource_id: string | null;
  readonly settlement_id: string | null;
  readonly settlements: {
    readonly name: string;
    readonly nation_id: string;
  } | null;
  readonly turn_transition_id: string;
  readonly turn_transitions: {
    readonly from_turn_number: number;
    readonly to_turn_number: number;
  } | null;
  readonly world_id: string;
};

function createRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    citizen_id: null,
    id: "entry-default",
    log_category: "test_event",
    nation_id: null,
    nations: null,
    payload_jsonb: {},
    resource_id: null,
    settlement_id: null,
    settlements: null,
    turn_transition_id: "tt-1",
    turn_transitions: { from_turn_number: 1, to_turn_number: 2 },
    world_id: "world-1",
    ...overrides,
  };
}

function createClient({
  rows,
  count,
  error = null,
}: {
  readonly rows: TestRow[];
  readonly count: number;
  readonly error?: { code: string; message: string } | null;
}): GubernatorSupabaseClient {
  const builder = {
    eq: vi.fn(),
    filter: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    returns: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.filter.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  builder.returns.mockResolvedValue({ data: rows, error, count });

  return {
    from: vi.fn().mockReturnValue(builder),
  } as unknown as GubernatorSupabaseClient;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
