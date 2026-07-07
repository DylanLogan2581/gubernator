import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderEndTurnControl } from "./HeaderEndTurnControl";

const { navigateMock, requireSupabaseClient, toastSuccess, toastError } =
  vi.hoisted(() => ({
    navigateMock: vi.fn(),
    requireSupabaseClient: vi.fn<() => unknown>(),
    toastSuccess:
      vi.fn<(message: string, options?: { description?: string }) => void>(),
    toastError: vi.fn<(message: string) => void>(),
  }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useRouter: () => ({
    state: {
      location: { href: "/worlds/world-1/turns" },
    },
  }),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

describe("HeaderEndTurnControl", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    requireSupabaseClient.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("renders nothing for non-admins", () => {
    const clientFixture = createClientFixture({ settlementRows: [] });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderHeaderEndTurnControl({ canAdmin: false });

    expect(screen.queryByRole("button", { name: /^End Turn/ })).toBeNull();
    expect(clientFixture.invoke).not.toHaveBeenCalled();
  });

  it("shows a compact readiness count once loaded", async () => {
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          auto_ready_enabled: true,
          is_ready_current_turn: true,
        }),
        createSettlementRow({ id: "settlement-2" }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderHeaderEndTurnControl();

    expect(
      await screen.findByRole("button", { name: "End Turn · 1/2 ready" }),
    ).toBeDefined();
  });

  it("opens the confirmation dialog and runs the same end-turn mutation as the full card", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          auto_ready_enabled: true,
          is_ready_current_turn: true,
        }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderHeaderEndTurnControl();

    await user.click(
      await screen.findByRole("button", { name: "End Turn · 1/1 ready" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-simulation", {
      body: {
        expectedTurnNumber: 7,
        worldId: "world-1",
      },
    });
    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("disables the control for archived worlds", async () => {
    const clientFixture = createClientFixture({ settlementRows: [] });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderHeaderEndTurnControl({ isArchived: true });

    const button = await screen.findByRole("button", {
      name: /^End Turn/,
    });

    expect(button).toBeDisabled();
    expect(clientFixture.invoke).not.toHaveBeenCalled();
  });
});

type ClientFixture = {
  readonly client: unknown;
  readonly invoke: ReturnType<typeof vi.fn>;
};
type TestSettlementReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
};

function renderHeaderEndTurnControl({
  canAdmin = true,
  currentDateLabel = "Firstday, Dawn 2, 101 AG",
  currentTurnNumber = 7,
  isArchived = false,
  nextDateLabel = "Secondday, Ember 1, 101 AG",
  nextTurnNumber = 8,
}: {
  readonly canAdmin?: boolean;
  readonly currentDateLabel?: string;
  readonly currentTurnNumber?: number;
  readonly isArchived?: boolean;
  readonly nextDateLabel?: string;
  readonly nextTurnNumber?: number;
} = {}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <HeaderEndTurnControl
        canAdmin={canAdmin}
        currentDateLabel={currentDateLabel}
        currentTurnNumber={currentTurnNumber}
        isArchived={isArchived}
        nextDateLabel={nextDateLabel}
        nextTurnNumber={nextTurnNumber}
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function createClientFixture({
  settlementRows,
}: {
  readonly settlementRows: readonly TestSettlementReadinessRow[];
}): ClientFixture {
  const invoke = vi.fn().mockReturnValue({
    data: {
      data: {
        actorId: "user-1",
        summary: {
          currentTurnNumber: 8,
          fromTurnNumber: 7,
          patchCounts: {
            assignmentClears: 0,
            bornOnTurnBackfill: 0,
            buildingStateChanges: 0,
            buildingsCreated: 0,
            citizenBirths: 0,
            citizenDeaths: 0,
            constructionUpdates: 0,
            depositUpdates: 0,
            logEntries: 0,
            managedPopulationUpdates: 0,
            notifications: 0,
            overshootStamped: 0,
            partnershipChanges: 0,
            readinessReset: 0,
            settlementSnapshots: 0,
            stockpileDeltas: 0,
            tradeRouteOutcomes: 0,
          },
          toTurnNumber: 8,
          transitionId: "transition-1",
        },
        worldId: "world-1",
      },
      ok: true,
    },
    error: null,
  });

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "settlements") {
          return createSettlementsQueryBuilder(settlementRows);
        }

        return createTurnTransitionsQueryBuilder();
      }),
      functions: {
        invoke,
      },
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    },
    invoke,
  };
}

function createSettlementRow(
  overrides: Partial<TestSettlementReadinessRow> = {},
): TestSettlementReadinessRow {
  return {
    auto_ready_enabled: false,
    id: "settlement-1",
    is_ready_current_turn: false,
    ...overrides,
  };
}

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementReadinessRow[],
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    select: vi.fn(() => builder),
  };

  return builder;
}

function createTurnTransitionsQueryBuilder(): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  return builder;
}
