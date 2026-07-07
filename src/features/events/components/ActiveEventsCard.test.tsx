import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActiveEventsCard } from "./ActiveEventsCard";

import type { EventWithGroup } from "../types/eventTypes";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const NATION_ID = "00000000-0000-0000-0000-000000000003";

function createEventRow(
  overrides: Partial<EventWithGroup> = {},
): EventWithGroup {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    world_id: WORLD_ID,
    event_group_id: null,
    name: "Drought",
    description: null,
    status: "active",
    effect_type: "resource_modifier",
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
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    group: null,
    ...overrides,
  };
}

function createClient({
  activeRows = [],
  expiredRows = [],
  expiredError = null,
}: {
  readonly activeRows?: readonly EventWithGroup[];
  readonly expiredRows?: readonly EventWithGroup[];
  readonly expiredError?: { readonly message: string } | null;
} = {}): unknown {
  const settlementBuilder: Record<string, unknown> = {
    eq: vi.fn(() => settlementBuilder),
    single: vi
      .fn()
      .mockResolvedValue({ data: { nation_id: NATION_ID }, error: null }),
  };

  function createEventsBuilder(): Record<string, unknown> {
    let statusFilter: string | null = null;
    const builder: Record<string, unknown> = {
      eq: vi.fn((column: string, value: string) => {
        if (column === "status") {
          statusFilter = value;
        }
        return builder;
      }),
      or: vi.fn(() => builder),
      order: vi.fn(() => {
        if (statusFilter === "expired") {
          if (expiredError !== null) {
            return Promise.resolve({ data: null, error: expiredError });
          }
          return Promise.resolve({ data: expiredRows, error: null });
        }
        return Promise.resolve({ data: activeRows, error: null });
      }),
    };
    return builder;
  }

  return {
    from: vi.fn((table: string) => {
      if (table === "settlements") {
        return { select: vi.fn(() => settlementBuilder) };
      }
      if (table === "events") {
        return { select: vi.fn(() => createEventsBuilder()) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function renderCard(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ActiveEventsCard
        scope="settlement"
        scopeId={SETTLEMENT_ID}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

describe("ActiveEventsCard", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders active events and does not fetch expired events until toggled", async () => {
    const client = createClient({
      activeRows: [createEventRow({ name: "Drought" })],
    });
    requireSupabaseClient.mockReturnValue(client);

    renderCard();

    await screen.findByText("Drought");
    expect(
      screen.getByRole("switch", { name: "Show expired" }),
    ).not.toBeChecked();
  });

  it("fetches and renders expired events when toggle is switched on", async () => {
    const client = createClient({
      activeRows: [createEventRow({ name: "Drought" })],
      expiredRows: [
        createEventRow({
          id: "00000000-0000-0000-0000-000000000011",
          name: "Old Famine",
          status: "expired",
        }),
      ],
    });
    requireSupabaseClient.mockReturnValue(client);

    const user = userEvent.setup();
    renderCard();

    await screen.findByText("Drought");
    expect(screen.queryByText("Old Famine")).toBeNull();

    await user.click(screen.getByRole("switch", { name: "Show expired" }));

    expect(await screen.findByText("Old Famine")).toBeDefined();
    expect(screen.getByText("Drought")).toBeDefined();
  });

  it("hides expired events again when toggled off", async () => {
    const client = createClient({
      activeRows: [createEventRow({ name: "Drought" })],
      expiredRows: [
        createEventRow({
          id: "00000000-0000-0000-0000-000000000011",
          name: "Old Famine",
          status: "expired",
        }),
      ],
    });
    requireSupabaseClient.mockReturnValue(client);

    const user = userEvent.setup();
    renderCard();

    await screen.findByText("Drought");
    const toggle = screen.getByRole("switch", { name: "Show expired" });
    await user.click(toggle);
    await screen.findByText("Old Famine");

    await user.click(toggle);
    expect(screen.queryByText("Old Famine")).toBeNull();
  });

  it("shows an error state when the expired events query fails", async () => {
    const client = createClient({
      activeRows: [createEventRow({ name: "Drought" })],
      expiredError: { message: "boom" },
    });
    requireSupabaseClient.mockReturnValue(client);

    const user = userEvent.setup();
    renderCard();

    await screen.findByText("Drought");
    await user.click(screen.getByRole("switch", { name: "Show expired" }));

    expect(
      await screen.findByText("Expired events could not be loaded"),
    ).toBeDefined();
  });
});
