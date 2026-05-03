import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EndTurnControl } from "./EndTurnControl";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("EndTurnControl", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows the current turn and readiness summary for admins", async () => {
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({ auto_ready_enabled: true }),
        createSettlementRow({ id: "settlement-2" }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    expect(
      await screen.findByRole("heading", { name: "End turn" }),
    ).toBeDefined();
    expect(
      screen.getByText("Advance the world from turn 7", { exact: false }),
    ).toBeDefined();
    expect(await screen.findByText("Current turn")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    expect(screen.getByText("Ready")).toBeDefined();
    expect(screen.getByText("Not ready")).toBeDefined();
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("hides the control for non-admin users and cannot submit", () => {
    const clientFixture = createClientFixture({ settlementRows: [] });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl({ canAdmin: false });

    expect(screen.queryByRole("button", { name: "End turn" })).toBeNull();
    expect(clientFixture.invoke).not.toHaveBeenCalled();
  });

  it("disables the control for archived worlds", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({ settlementRows: [] });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl({ isArchived: true });

    const button = await screen.findByRole("button", { name: "End turn" });

    expect(button).toBeDisabled();
    expect(
      screen.getByText("End turn is disabled because this world is archived."),
    ).toBeDefined();

    await user.click(button);

    expect(clientFixture.invoke).not.toHaveBeenCalled();
  });

  it("shows pending state while the transition is running", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: new Promise(() => {}),
      settlementRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");

    await user.click(await screen.findByRole("button", { name: "End turn" }));

    expect(
      await screen.findByRole("button", { name: "Ending turn..." }),
    ).toBeDisabled();
    expect(screen.getByText("End-turn transition is running.")).toBeDefined();
    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-basic", {
      body: {
        expectedTurnNumber: 7,
        worldId: "world-1",
      },
    });
  });

  it("prevents duplicate-click submissions while pending", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: new Promise(() => {}),
      settlementRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");

    const button = await screen.findByRole("button", { name: "End turn" });

    await user.click(button);
    await user.click(
      await screen.findByRole("button", { name: "Ending turn..." }),
    );

    expect(clientFixture.invoke).toHaveBeenCalledTimes(1);
  });
});

type ClientFixture = {
  readonly client: unknown;
  readonly invoke: ReturnType<typeof vi.fn>;
};
type FunctionInvokeResult =
  | Promise<unknown>
  | {
      readonly data: unknown;
      readonly error: unknown;
    };
type TestSettlementReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
};

function renderEndTurnControl({
  canAdmin = true,
  currentTurnNumber = 7,
  isArchived = false,
}: {
  readonly canAdmin?: boolean;
  readonly currentTurnNumber?: number;
  readonly isArchived?: boolean;
} = {}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <EndTurnControl
        canAdmin={canAdmin}
        currentTurnNumber={currentTurnNumber}
        isArchived={isArchived}
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
  invokeResult = {
    data: {
      data: {
        actorId: "user-1",
        transition: {
          nextTurnNumber: 8,
          previousTurnNumber: 7,
        },
        worldId: "world-1",
      },
      ok: true,
    },
    error: null,
  },
  settlementRows,
}: {
  readonly invokeResult?: FunctionInvokeResult;
  readonly settlementRows: readonly TestSettlementReadinessRow[];
}): ClientFixture {
  const invoke = vi.fn().mockReturnValue(invokeResult);

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "settlements") {
          return createSettlementsQueryBuilder(settlementRows);
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      functions: {
        invoke,
      },
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
