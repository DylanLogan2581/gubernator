import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TurnTransitionOutcomeContent,
  TurnTransitionOutcomeEmptyState,
  TurnTransitionOutcomePanel,
} from "./TurnTransitionOutcomePanel";

import type { TurnTransitionOutcome } from "../queries/turnTransitionOutcomeQueries";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

// -- TurnTransitionOutcomeEmptyState --

describe("TurnTransitionOutcomeEmptyState", () => {
  it("renders the empty state heading and message", () => {
    render(<TurnTransitionOutcomeEmptyState />);

    expect(
      screen.getByRole("heading", { name: "Last transition" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "No transitions have run yet on the new simulation engine.",
      ),
    ).toBeDefined();
  });
});

// -- TurnTransitionOutcomeContent --

describe("TurnTransitionOutcomeContent", () => {
  it("renders transition number and date in the populated state", () => {
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    expect(
      screen.getByRole("heading", { name: "Last transition" }),
    ).toBeDefined();
    expect(screen.getByText("Turn 5 → 6 · 2026-06-01")).toBeDefined();
  });

  it("renders delta metrics from settlement snapshots", () => {
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    expectMetric("Births", "3");
    expectMetric("Deaths", "1");
    expectMetric("Buildings Suspended", "1");
    expectMetric("Deposits Depleted", "1");
  });

  it("renders notifications grouped by type in collapsed state", () => {
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    expect(screen.getByText("Notifications this turn")).toBeDefined();
    expect(screen.getByText("Buildings Suspended (1)")).toBeDefined();
    expect(screen.getByText("Deposits Depleted (1)")).toBeDefined();

    // Accordion items should exist (shadcn accordion uses data-state="closed" for collapsed)
    const accordionTriggers = document.querySelectorAll(
      "[data-state='closed']",
    );
    expect(accordionTriggers.length).toBeGreaterThan(0);
  });

  it("expands group to show notifications when accordion is opened", async () => {
    const user = userEvent.setup();
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    const buildingsSuspendedTrigger = screen.getByText(
      "Buildings Suspended (1)",
    );
    await user.click(buildingsSuspendedTrigger);

    expect(
      screen.getByText("Ironforge mill suspended due to missing upkeep."),
    ).toBeDefined();
  });

  it("collapses groups by default", () => {
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    const closedAccordionItems = document.querySelectorAll(
      "[data-state='closed']",
    );
    expect(closedAccordionItems.length).toBeGreaterThan(0);
  });

  it("renders 'no notifications' message when notifications are empty", () => {
    const outcome: TurnTransitionOutcome = {
      ...createPopulatedOutcome(),
      notifications: [],
    };

    render(<TurnTransitionOutcomeContent outcome={outcome} />);

    expect(
      screen.getByText("No notifications for this transition."),
    ).toBeDefined();
  });

  it("renders aggregate deltas across multiple settlement snapshots", () => {
    const outcome: TurnTransitionOutcome = {
      ...createPopulatedOutcome(),
      settlementSnapshots: [
        createSettlementSnapshot({
          birthCount: 2,
          deathCount: 1,
          settlementId: "s-1",
        }),
        createSettlementSnapshot({
          birthCount: 4,
          deathCount: 3,
          settlementId: "s-2",
        }),
      ],
    };

    render(<TurnTransitionOutcomeContent outcome={outcome} />);

    expectMetric("Births", "6");
    expectMetric("Deaths", "4");
  });

  it("filters groups when a category chip is clicked", async () => {
    const user = userEvent.setup();
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    // Initially both group triggers should be present (no filter active)
    expect(screen.getByText("Buildings Suspended (1)")).toBeDefined();
    expect(screen.getByText("Deposits Depleted (1)")).toBeDefined();

    // Click the "Buildings Suspended" toggle to include only that category
    const buildingsChip = screen.getByRole("button", {
      name: "Filter by Buildings Suspended",
    });
    await user.click(buildingsChip);

    // Only "Buildings Suspended" should remain (it is the selected/included category)
    expect(screen.getByText("Buildings Suspended (1)")).toBeDefined();
    expect(screen.queryByText("Deposits Depleted (1)")).toBeNull();
  });

  it("resets filter when All chip is clicked", async () => {
    const user = userEvent.setup();
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    // Select one category via toggle (include it)
    const buildingsChip = screen.getByRole("button", {
      name: "Filter by Buildings Suspended",
    });
    await user.click(buildingsChip);

    // Only the selected category should be visible
    expect(screen.getByText("Buildings Suspended (1)")).toBeDefined();
    expect(screen.queryByText("Deposits Depleted (1)")).toBeNull();

    // Click "All" to reset
    const allChip = screen.getByRole("button", { name: "All" });
    await user.click(allChip);

    // Both groups should be visible again
    expect(screen.getByText("Buildings Suspended (1)")).toBeDefined();
    expect(screen.getByText("Deposits Depleted (1)")).toBeDefined();
  });

  it("shows finish date as date-only prefix from ISO string", () => {
    const outcome: TurnTransitionOutcome = {
      ...createPopulatedOutcome(),
      finishedAt: "2026-05-15T08:30:00Z",
    };

    render(<TurnTransitionOutcomeContent outcome={outcome} />);

    expect(screen.getByText("Turn 5 → 6 · 2026-05-15")).toBeDefined();
  });

  it("omits date when finishedAt is null", () => {
    const outcome: TurnTransitionOutcome = {
      ...createPopulatedOutcome(),
      finishedAt: null,
    };

    render(<TurnTransitionOutcomeContent outcome={outcome} />);

    expect(screen.getByText("Turn 5 → 6")).toBeDefined();
  });
});

// -- TurnTransitionOutcomePanel (full integration with mocked Supabase) --

describe("TurnTransitionOutcomePanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows loading state before the query resolves", () => {
    requireSupabaseClient.mockReturnValue(createPendingWorldClient());

    render(
      <QueryClientProvider client={createQueryClient()}>
        <TurnTransitionOutcomePanel scope="world" id="world-1" />
      </QueryClientProvider>,
    );

    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
  });

  it("shows empty state when no transition exists for the world", async () => {
    requireSupabaseClient.mockReturnValue(createWorldClient(null));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <TurnTransitionOutcomePanel scope="world" id="world-1" />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Last transition" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "No transitions have run yet on the new simulation engine.",
      ),
    ).toBeDefined();
  });

  it("shows empty state when no transition exists for the settlement", async () => {
    requireSupabaseClient.mockReturnValue(createSettlementClient(null));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <TurnTransitionOutcomePanel scope="settlement" id="settlement-1" />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Last transition" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "No transitions have run yet on the new simulation engine.",
      ),
    ).toBeDefined();
  });

  it("renders populated outcome for world scope", async () => {
    requireSupabaseClient.mockReturnValue(
      createWorldClient(createTransitionRow()),
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <TurnTransitionOutcomePanel scope="world" id="world-1" />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Last transition" }),
    ).toBeDefined();
    expect(screen.getByText("Turn 5 → 6 · 2026-06-01")).toBeDefined();
  });

  it("excludes world-scope notifications from the settlement-scoped panel", async () => {
    const row: TestTransitionRow = {
      ...createTransitionRow(),
      notifications: [
        createRawNotification({
          id: "notif-world",
          settlement_id: null,
          message_text: "World-scope event.",
          notification_type: "partnership.formed",
        }),
        createRawNotification({
          id: "notif-settlement",
          settlement_id: "settlement-1",
          message_text: "Settlement-scope event.",
          notification_type: "deposit.depleted",
        }),
      ],
    };
    requireSupabaseClient.mockReturnValue(
      createSettlementClientWithRow("settlement-1", row),
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <TurnTransitionOutcomePanel scope="settlement" id="settlement-1" />
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { name: "Last transition" });
    expect(screen.queryByText("World-scope event.")).toBeNull();
    // Open the accordion to see the hidden content
    const depositAccordionTrigger = screen.getByText(/Deposits Depleted \(1\)/);
    const user = userEvent.setup();
    await user.click(depositAccordionTrigger);
    expect(screen.getByText("Settlement-scope event.")).toBeDefined();
  });

  it("shows world-scope notifications on the world-scope panel", async () => {
    const row: TestTransitionRow = {
      ...createTransitionRow(),
      notifications: [
        createRawNotification({
          id: "notif-world",
          settlement_id: null,
          message_text: "World-scope event.",
          notification_type: "partnership.formed",
        }),
      ],
    };
    requireSupabaseClient.mockReturnValue(createWorldClient(row));

    render(
      <QueryClientProvider client={createQueryClient()}>
        <TurnTransitionOutcomePanel scope="world" id="world-1" />
      </QueryClientProvider>,
    );

    // Open the accordion to see the hidden content
    const partnershipAccordionTrigger = await screen.findByText(
      /Partnerships Formed \(1\)/,
    );
    const user = userEvent.setup();
    await user.click(partnershipAccordionTrigger);
    expect(screen.getByText("World-scope event.")).toBeDefined();
  });
});

// -- Fixtures --

function createPopulatedOutcome(): TurnTransitionOutcome {
  return {
    finishedAt: "2026-06-01T12:00:00Z",
    forecastSnapshot: null,
    fromTurnNumber: 5,
    id: "transition-1",
    logEntries: [],
    notifications: [
      createNotification({
        id: "notif-1",
        messageText: "Ironforge mill suspended due to missing upkeep.",
        notificationType: "building.suspended",
        settlementId: "settlement-1",
      }),
      createNotification({
        id: "notif-2",
        messageText: "Iron vein exhausted.",
        notificationType: "deposit.depleted",
        settlementId: "settlement-1",
      }),
    ],
    settlementResourceSnapshots: [],
    settlementSnapshots: [
      createSettlementSnapshot({
        birthCount: 3,
        deathCount: 1,
        settlementId: "settlement-1",
      }),
    ],
    startedAt: "2026-06-01T11:55:00Z",
    status: "completed",
    toTurnNumber: 6,
    worldId: "world-1",
  };
}

function createNotification(
  overrides: Partial<TurnTransitionOutcome["notifications"][number]> = {},
): TurnTransitionOutcome["notifications"][number] {
  return {
    citizenId: null,
    generatedAt: "2026-06-01T12:00:00Z",
    generatedInTransitionId: "transition-1",
    id: "notif-1",
    isRead: false,
    messageText: "A notification occurred.",
    nationId: null,
    notificationType: "building.suspended",
    recipientUserId: "user-1",
    settlementId: "settlement-1",
    worldId: "world-1",
    ...overrides,
  };
}

function createSettlementSnapshot(
  overrides: Partial<TurnTransitionOutcome["settlementSnapshots"][number]> = {},
): TurnTransitionOutcome["settlementSnapshots"][number] {
  return {
    birthCount: 0,
    deathCount: 0,
    homelessDeathsCount: 0,
    id: "snap-1",
    populationCap: 100,
    populationNpc: 50,
    populationPlayerCharacter: 0,
    populationTotal: 50,
    settlementId: "settlement-1",
    starvationDeathsCount: 0,
    turnNumber: 6,
    worldId: "world-1",
    ...overrides,
  };
}

// -- Client helpers --

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

type TestTransitionRow = {
  readonly finished_at: string | null;
  readonly from_turn_number: number;
  readonly id: string;
  readonly notifications: readonly unknown[];
  readonly settlement_turn_resource_snapshots: readonly unknown[];
  readonly settlement_turn_snapshots: readonly unknown[];
  readonly started_at: string;
  readonly status: string;
  readonly to_turn_number: number;
  readonly world_id: string;
  readonly turn_log_entries: readonly unknown[];
};

function createTransitionRow(): TestTransitionRow {
  return {
    finished_at: "2026-06-01T12:00:00Z",
    from_turn_number: 5,
    id: "transition-1",
    notifications: [],
    settlement_turn_resource_snapshots: [],
    settlement_turn_snapshots: [],
    started_at: "2026-06-01T11:55:00Z",
    status: "completed",
    to_turn_number: 6,
    turn_log_entries: [],
    world_id: "world-1",
  };
}

function createWorldClient(row: TestTransitionRow | null): unknown {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.returns = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "turn_transitions") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createSettlementClient(row: TestTransitionRow | null): unknown {
  const snapshotBuilder: Record<string, unknown> = {};
  snapshotBuilder.select = vi.fn(() => snapshotBuilder);
  snapshotBuilder.eq = vi.fn(() => snapshotBuilder);
  snapshotBuilder.not = vi.fn(() => snapshotBuilder);
  snapshotBuilder.order = vi.fn(() => snapshotBuilder);
  snapshotBuilder.limit = vi.fn(() => snapshotBuilder);
  snapshotBuilder.returns = vi.fn(() => snapshotBuilder);
  snapshotBuilder.maybeSingle = vi.fn().mockResolvedValue({
    data: row !== null ? { turn_transition_id: row.id } : null,
    error: null,
  });

  const transitionBuilder: Record<string, unknown> = {};
  transitionBuilder.select = vi.fn(() => transitionBuilder);
  transitionBuilder.eq = vi.fn(() => transitionBuilder);
  transitionBuilder.returns = vi.fn(() => transitionBuilder);
  transitionBuilder.maybeSingle = vi.fn().mockResolvedValue({
    data:
      row !== null
        ? {
            id: row.id,
            world_id: row.world_id,
            from_turn_number: row.from_turn_number,
            to_turn_number: row.to_turn_number,
            status: row.status,
            started_at: row.started_at,
            finished_at: row.finished_at,
          }
        : null,
    error: null,
  });

  const makeChildBuilder = (
    data: readonly unknown[],
  ): Record<string, unknown> => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.returns = vi.fn(() => Promise.resolve({ data, error: null }));
    return builder;
  };

  const callCounts: Record<string, number> = {};

  return {
    from: vi.fn((table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;

      if (table === "settlement_turn_snapshots") {
        // First call: initial snapshot lookup
        if (callCounts[table] === 1) {
          return snapshotBuilder;
        }
        // Second call: child table query (in Promise.all)
        return makeChildBuilder(row?.settlement_turn_snapshots ?? []);
      }
      if (table === "turn_transitions") {
        return transitionBuilder;
      }
      if (table === "settlement_turn_resource_snapshots") {
        return makeChildBuilder(row?.settlement_turn_resource_snapshots ?? []);
      }
      if (table === "turn_log_entries") {
        return makeChildBuilder(row?.turn_log_entries ?? []);
      }
      if (table === "notifications") {
        return makeChildBuilder(row?.notifications ?? []);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function createSettlementClientWithRow(
  _settlementId: string,
  row: TestTransitionRow,
): unknown {
  const snapshotBuilder: Record<string, unknown> = {};
  snapshotBuilder.select = vi.fn(() => snapshotBuilder);
  snapshotBuilder.eq = vi.fn(() => snapshotBuilder);
  snapshotBuilder.not = vi.fn(() => snapshotBuilder);
  snapshotBuilder.order = vi.fn(() => snapshotBuilder);
  snapshotBuilder.limit = vi.fn(() => snapshotBuilder);
  snapshotBuilder.returns = vi.fn(() => snapshotBuilder);
  snapshotBuilder.maybeSingle = vi.fn().mockResolvedValue({
    data: { turn_transition_id: row.id },
    error: null,
  });

  const transitionBuilder: Record<string, unknown> = {};
  transitionBuilder.select = vi.fn(() => transitionBuilder);
  transitionBuilder.eq = vi.fn(() => transitionBuilder);
  transitionBuilder.returns = vi.fn(() => transitionBuilder);
  transitionBuilder.maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: row.id,
      world_id: row.world_id,
      from_turn_number: row.from_turn_number,
      to_turn_number: row.to_turn_number,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
    },
    error: null,
  });

  const makeChildBuilder = (
    data: readonly unknown[],
  ): Record<string, unknown> => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.returns = vi.fn(() => Promise.resolve({ data, error: null }));
    return builder;
  };

  // Create a smarter notifications builder that filters by settlement_id
  const notificationsBuilder: Record<string, unknown> = {};
  let filteredNotifications: readonly unknown[] = row.notifications;
  notificationsBuilder.select = vi.fn(() => notificationsBuilder);
  notificationsBuilder.eq = vi.fn((column: string, value: unknown) => {
    if (column === "settlement_id") {
      filteredNotifications = row.notifications.filter(
        (n: unknown) => (n as Record<string, unknown>).settlement_id === value,
      );
    }
    return notificationsBuilder;
  });
  notificationsBuilder.returns = vi.fn(() =>
    Promise.resolve({ data: filteredNotifications, error: null }),
  );

  const callCounts: Record<string, number> = {};

  return {
    from: vi.fn((table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;

      if (table === "settlement_turn_snapshots") {
        // First call: initial snapshot lookup
        if (callCounts[table] === 1) {
          return snapshotBuilder;
        }
        // Second call: child table query (in Promise.all)
        return makeChildBuilder(row.settlement_turn_snapshots);
      }
      if (table === "turn_transitions") {
        return transitionBuilder;
      }
      if (table === "settlement_turn_resource_snapshots") {
        return makeChildBuilder(row.settlement_turn_resource_snapshots);
      }
      if (table === "turn_log_entries") {
        return makeChildBuilder(row.turn_log_entries);
      }
      if (table === "notifications") {
        // Reset filtered notifications for each new query
        filteredNotifications = row.notifications;
        return notificationsBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

type RawNotification = {
  readonly citizen_id: null;
  readonly generated_at: string;
  readonly generated_in_transition_id: string;
  readonly id: string;
  readonly is_read: boolean;
  readonly message_text: string;
  readonly nation_id: null;
  readonly notification_type: string;
  readonly recipient_user_id: string;
  readonly settlement_id: string | null;
  readonly world_id: string;
};

function createRawNotification(
  overrides: Partial<RawNotification> = {},
): RawNotification {
  return {
    citizen_id: null,
    generated_at: "2026-06-01T12:00:00Z",
    generated_in_transition_id: "transition-1",
    id: "notif-1",
    is_read: false,
    message_text: "A notification occurred.",
    nation_id: null,
    notification_type: "building.suspended",
    recipient_user_id: "user-1",
    settlement_id: "settlement-1",
    world_id: "world-1",
    ...overrides,
  };
}

function createPendingWorldClient(): unknown {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(
    () =>
      new Promise(() => {
        // Never resolves — keeps the query pending.
      }),
  );

  return {
    from: vi.fn((table: string) => {
      if (table === "turn_transitions") {
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

// -- Assertion helpers --

function expectMetric(label: string, value: string): void {
  // Find the metrics grid (first dl element, which contains the metrics)
  const metricsGrid = document.querySelector("section dl");
  expect(metricsGrid).not.toBeNull();

  if (metricsGrid === null) {
    return;
  }

  // Find the dt with matching label within the metrics grid
  const dts = metricsGrid.querySelectorAll("dt");
  let found = false;
  dts.forEach((dt) => {
    if (dt.textContent === label) {
      const group = dt.closest("div");
      expect(group).toHaveTextContent(value);
      found = true;
    }
  });
  expect(found).toBe(true);
}
