import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  activeNationEventsQueryOptions,
  activeSettlementEventsQueryOptions,
  eventDetailQueryOptions,
  eventsListQueryOptions,
  expiredNationEventsQueryOptions,
  expiredSettlementEventsQueryOptions,
} from "./eventQueries";
import { eventQueryKeys } from "./eventQueryKeys";

import type { EventEffect, EventWithGroup } from "../types/eventTypes";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_ID = "22222222-2222-2222-2222-222222222222";
const NATION_ID = "33333333-3333-3333-3333-333333333333";
const EVENT_ID = "44444444-4444-4444-4444-444444444444";

type SupabaseError = { readonly code?: string; readonly message: string };

function createEventRow(
  overrides: Partial<EventWithGroup> = {},
): EventWithGroup {
  return {
    id: EVENT_ID,
    world_id: WORLD_ID,
    event_group_id: null,
    name: "Drought",
    description: null,
    status: "active",
    effect_type: "resource_drain",
    effect_payload_jsonb: null,
    activate_on_transition_after_turn_number: 1,
    scope_type: "settlement",
    scope_nation_id: null,
    scope_settlement_id: SETTLEMENT_ID,
    duration_type: "sustained",
    duration_transitions: 3,
    remaining_transitions: 2,
    job_id: null,
    building_blueprint_id: null,
    managed_population_type_id: null,
    amount_value: null,
    multiplier_value: null,
    extra_data_jsonb: null,
    create_citizen_memories: false,
    memory_text: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    group: null,
    ...overrides,
  };
}

function createEventsQueryBuilder(
  rows: readonly EventWithGroup[],
  error: SupabaseError | null = null,
): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    then: (resolve: (result: { data: unknown; error: unknown }) => void) =>
      resolve({ data: error === null ? rows : null, error }),
  };
  return builder;
}

function createSettlementBuilder(
  nationId: string | null,
  error: SupabaseError | null = null,
): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    eq: vi.fn(() => builder),
    single: vi
      .fn()
      .mockResolvedValue(
        error !== null
          ? { data: null, error }
          : { data: { nation_id: nationId }, error: null },
      ),
  };
  return builder;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe("eventQueryKeys", () => {
  it("builds hierarchical keys scoped by world", () => {
    expect(eventQueryKeys.byWorld(WORLD_ID)).toEqual([
      "events",
      "by-world",
      WORLD_ID,
    ]);
    expect(eventQueryKeys.detail(WORLD_ID, EVENT_ID)).toEqual([
      "events",
      "by-world",
      WORLD_ID,
      "detail",
      EVENT_ID,
    ]);
    expect(eventQueryKeys.bySettlement(WORLD_ID, SETTLEMENT_ID)).toEqual([
      "events",
      "by-world",
      WORLD_ID,
      "settlement",
      SETTLEMENT_ID,
    ]);
    expect(eventQueryKeys.expiredBySettlement(WORLD_ID, SETTLEMENT_ID)).toEqual(
      ["events", "by-world", WORLD_ID, "settlement", SETTLEMENT_ID, "expired"],
    );
    expect(eventQueryKeys.byNation(WORLD_ID, NATION_ID)).toEqual([
      "events",
      "by-world",
      WORLD_ID,
      "nation",
      NATION_ID,
    ]);
    expect(eventQueryKeys.expiredByNation(WORLD_ID, NATION_ID)).toEqual([
      "events",
      "by-world",
      WORLD_ID,
      "nation",
      NATION_ID,
      "expired",
    ]);
  });

  it("serializes filters into the list key so distinct filters cache separately", () => {
    const withoutFilters = eventQueryKeys.list(WORLD_ID);
    const withFilters = eventQueryKeys.list(WORLD_ID, {
      statusFilter: ["active"],
    });

    expect(withoutFilters).not.toEqual(withFilters);
    expect(withFilters[withFilters.length - 1]).toBe(
      JSON.stringify({ statusFilter: ["active"] }),
    );
  });
});

describe("eventsListQueryOptions", () => {
  it("selects events for the world ordered by created_at by default", async () => {
    const select = vi.fn(() => createEventsQueryBuilder([createEventRow()]));
    const client = {
      from: vi.fn(() => ({ select })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      eventsListQueryOptions(WORLD_ID, undefined, client),
    );

    expect(result).toEqual([createEventRow()]);
    expect(select).toHaveBeenCalledWith("*,group:event_groups(*)");
  });

  it("applies the status filter via .in()", async () => {
    const builder = createEventsQueryBuilder([
      createEventRow({ status: "active" }),
    ]);
    const select = vi.fn(() => builder);
    const client = {
      from: vi.fn(() => ({ select })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      eventsListQueryOptions(
        WORLD_ID,
        { statusFilter: ["active", "pending"] },
        client,
      ),
    );

    expect(builder.in).toHaveBeenCalledWith("status", ["active", "pending"]);
  });

  it("sorts client-side by lifecycle order when sortBy is status", async () => {
    const rows = [
      createEventRow({ id: "1", status: "cancelled" }),
      createEventRow({ id: "2", status: "active" }),
      createEventRow({ id: "3", status: "expired" }),
      createEventRow({ id: "4", status: "pending" }),
    ];
    const select = vi.fn(() => createEventsQueryBuilder(rows));
    const client = {
      from: vi.fn(() => ({ select })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      eventsListQueryOptions(WORLD_ID, { sortBy: "status" }, client),
    );

    expect(result.map((row) => row.status)).toEqual([
      "active",
      "pending",
      "expired",
      "cancelled",
    ]);
  });

  it("resolves the settlement's nation and builds a combined scope filter", async () => {
    const eventsBuilder = createEventsQueryBuilder([createEventRow()]);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "settlements") {
          return {
            select: vi.fn(() => createSettlementBuilder(NATION_ID)),
          };
        }
        if (table === "events") {
          return { select: vi.fn(() => eventsBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      eventsListQueryOptions(
        WORLD_ID,
        { scopeEntityFilter: { type: "settlement", id: SETTLEMENT_ID } },
        client,
      ),
    );

    expect(eventsBuilder.or).toHaveBeenCalledWith(
      `and(scope_type.eq.settlement,scope_settlement_id.eq.${SETTLEMENT_ID}),and(scope_type.eq.nation,scope_nation_id.eq.${NATION_ID}),scope_type.eq.world`,
    );
  });

  it("omits the nation clause when the settlement has no nation", async () => {
    const eventsBuilder = createEventsQueryBuilder([createEventRow()]);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "settlements") {
          return { select: vi.fn(() => createSettlementBuilder(null)) };
        }
        if (table === "events") {
          return { select: vi.fn(() => eventsBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      eventsListQueryOptions(
        WORLD_ID,
        { scopeEntityFilter: { type: "settlement", id: SETTLEMENT_ID } },
        client,
      ),
    );

    expect(eventsBuilder.or).toHaveBeenCalledWith(
      `and(scope_type.eq.settlement,scope_settlement_id.eq.${SETTLEMENT_ID}),scope_type.eq.world`,
    );
  });

  it("builds a nation-scoped filter for a nation scope entity", async () => {
    const eventsBuilder = createEventsQueryBuilder([createEventRow()]);
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => eventsBuilder) })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      eventsListQueryOptions(
        WORLD_ID,
        { scopeEntityFilter: { type: "nation", id: NATION_ID } },
        client,
      ),
    );

    expect(eventsBuilder.or).toHaveBeenCalledWith(
      `and(scope_type.eq.nation,scope_nation_id.eq.${NATION_ID}),scope_type.eq.world`,
    );
  });

  it("throws a normalized error when the query fails", async () => {
    const select = vi.fn(() =>
      createEventsQueryBuilder([], { message: "boom" }),
    );
    const client = {
      from: vi.fn(() => ({ select })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        eventsListQueryOptions(WORLD_ID, undefined, client),
      ),
    ).rejects.toThrow("boom");
  });
});

describe("eventDetailQueryOptions", () => {
  it("fetches the event and merges its effects", async () => {
    const eventRow = createEventRow();
    const effectRow: EventEffect = {
      id: "55555555-5555-5555-5555-555555555555",
      event_id: EVENT_ID,
      effect_type: "resource_drain",
      amount_value: 10,
      multiplier_value: null,
      is_percent: false,
      resource_id: null,
      job_id: null,
      managed_population_instance_id: null,
      managed_population_type_id: null,
      deposit_instance_id: null,
      settlement_building_id: null,
      extra_data_jsonb: null,
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    };

    const eventsBuilder: Record<string, unknown> = {
      eq: vi.fn(() => eventsBuilder),
      single: vi.fn().mockResolvedValue({ data: eventRow, error: null }),
    };
    const effectsBuilder: Record<string, unknown> = {
      eq: vi.fn(() => effectsBuilder),
      returns: vi.fn().mockResolvedValue({ data: [effectRow], error: null }),
    };
    const client = {
      from: vi.fn((table: string) => {
        if (table === "events") return { select: vi.fn(() => eventsBuilder) };
        if (table === "event_effects")
          return { select: vi.fn(() => effectsBuilder) };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      eventDetailQueryOptions(WORLD_ID, EVENT_ID, client),
    );

    expect(result).toEqual({ ...eventRow, effects: [effectRow] });
  });

  it("throws when the event is not found", async () => {
    const eventsBuilder: Record<string, unknown> = {
      eq: vi.fn(() => eventsBuilder),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => eventsBuilder) })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        eventDetailQueryOptions(WORLD_ID, EVENT_ID, client),
      ),
    ).rejects.toThrow("Event not found");
  });
});

describe("activeSettlementEventsQueryOptions", () => {
  it("filters to active status and the settlement's scope chain", async () => {
    const eventsBuilder = createEventsQueryBuilder([
      createEventRow({ status: "active" }),
    ]);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "settlements") {
          return { select: vi.fn(() => createSettlementBuilder(NATION_ID)) };
        }
        if (table === "events") {
          return { select: vi.fn(() => eventsBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      activeSettlementEventsQueryOptions(WORLD_ID, SETTLEMENT_ID, client),
    );

    expect(eventsBuilder.eq).toHaveBeenCalledWith("status", "active");
    expect(eventsBuilder.or).toHaveBeenCalledWith(
      `and(scope_type.eq.settlement,scope_settlement_id.eq.${SETTLEMENT_ID}),and(scope_type.eq.nation,scope_nation_id.eq.${NATION_ID}),scope_type.eq.world`,
    );
  });
});

describe("activeNationEventsQueryOptions", () => {
  it("filters to active status and the nation's scope chain", async () => {
    const eventsBuilder = createEventsQueryBuilder([
      createEventRow({ status: "active", scope_type: "nation" }),
    ]);
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => eventsBuilder) })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      activeNationEventsQueryOptions(WORLD_ID, NATION_ID, client),
    );

    expect(eventsBuilder.eq).toHaveBeenCalledWith("status", "active");
    expect(eventsBuilder.or).toHaveBeenCalledWith(
      `and(scope_type.eq.nation,scope_nation_id.eq.${NATION_ID}),scope_type.eq.world`,
    );
  });
});

describe("expiredSettlementEventsQueryOptions", () => {
  it("filters to expired status ordered by updated_at", async () => {
    const eventsBuilder = createEventsQueryBuilder([
      createEventRow({ status: "expired" }),
    ]);
    const client = {
      from: vi.fn((table: string) => {
        if (table === "settlements") {
          return { select: vi.fn(() => createSettlementBuilder(NATION_ID)) };
        }
        if (table === "events") {
          return { select: vi.fn(() => eventsBuilder) };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      expiredSettlementEventsQueryOptions(WORLD_ID, SETTLEMENT_ID, client),
    );

    expect(eventsBuilder.eq).toHaveBeenCalledWith("status", "expired");
    expect(eventsBuilder.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
  });
});

describe("expiredNationEventsQueryOptions", () => {
  it("filters to expired status ordered by updated_at", async () => {
    const eventsBuilder = createEventsQueryBuilder([
      createEventRow({ status: "expired", scope_type: "nation" }),
    ]);
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => eventsBuilder) })),
    } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      expiredNationEventsQueryOptions(WORLD_ID, NATION_ID, client),
    );

    expect(eventsBuilder.eq).toHaveBeenCalledWith("status", "expired");
    expect(eventsBuilder.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
  });
});
