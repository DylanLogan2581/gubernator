import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
    expectMetric("Buildings suspended", "1");
    expectMetric("Deposits depleted", "1");
  });

  it("renders notifications grouped by type", () => {
    render(<TurnTransitionOutcomeContent outcome={createPopulatedOutcome()} />);

    expect(screen.getByText("Notifications")).toBeDefined();
    expect(screen.getByText("Buildings suspended (1)")).toBeDefined();
    expect(
      screen.getByText("Ironforge mill suspended due to missing upkeep."),
    ).toBeDefined();
    expect(screen.getByText("Deposits depleted (1)")).toBeDefined();
    expect(screen.getByText("Iron vein exhausted.")).toBeDefined();
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

    expect(screen.getByText("Loading transition outcome…")).toBeDefined();
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
});

// -- Fixtures --

function createPopulatedOutcome(): TurnTransitionOutcome {
  return {
    finishedAt: "2026-06-01T12:00:00Z",
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
  snapshotBuilder.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: null, error: null });

  const transitionBuilder: Record<string, unknown> = {};
  transitionBuilder.select = vi.fn(() => transitionBuilder);
  transitionBuilder.eq = vi.fn(() => transitionBuilder);
  transitionBuilder.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: row, error: null });

  return {
    from: vi.fn((table: string) => {
      if (table === "settlement_turn_snapshots") {
        return snapshotBuilder;
      }
      if (table === "turn_transitions") {
        return transitionBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
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
  const term = screen.getByText(label);
  const group = term.closest("div");
  expect(group).not.toBeNull();
  expect(group).toHaveTextContent(value);
}
