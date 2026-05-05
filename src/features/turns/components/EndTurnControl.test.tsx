import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
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

  it("floors uneven readiness percentages in summary labels", async () => {
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({ auto_ready_enabled: true }),
        createSettlementRow({
          id: "settlement-2",
          is_ready_current_turn: true,
        }),
        createSettlementRow({ id: "settlement-3" }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    expect(await screen.findByText("Ready percent")).toBeDefined();
    expect(screen.getByText("66%")).toBeDefined();
    expect(screen.queryByText("66.66666666666666%")).toBeNull();
  });

  it("floors uneven readiness percentages in confirmation copy", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({ auto_ready_enabled: true }),
        createSettlementRow({
          id: "settlement-2",
          is_ready_current_turn: true,
        }),
        createSettlementRow({ id: "settlement-3" }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));

    expect(
      await screen.findByText("2 of 3 settlements ready (66%). 1 not ready."),
    ).toBeDefined();
    expect(screen.queryByText(/66\.66666666666666%/i)).toBeNull();
  });

  it("confirms an all-ready end turn with current and next turn details", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({ auto_ready_enabled: true }),
        createSettlementRow({
          id: "settlement-2",
          is_ready_current_turn: true,
        }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));

    expect(
      await screen.findByRole("dialog", { name: "Confirm end turn" }),
    ).toBeDefined();
    expect(screen.getAllByText("Current turn").length).toBeGreaterThan(0);
    expect(screen.getByText("Next turn")).toBeDefined();
    expect(screen.getByText("8")).toBeDefined();
    expect(screen.getByText("Current date")).toBeDefined();
    expect(screen.getByText("Firstday, Dawn 2, 101 AG")).toBeDefined();
    expect(screen.getByText("Next date")).toBeDefined();
    expect(screen.getByText("Secondday, Ember 1, 101 AG")).toBeDefined();
    expect(screen.getByText("Readiness summary")).toBeDefined();
    expect(screen.getByText(/2 of 2 settlements ready/i)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Confirm end turn" }));

    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-basic", {
      body: {
        expectedTurnNumber: 7,
        worldId: "world-1",
      },
    });
  });

  it("shows numeric turn values in the confirmation dialog for turn zero", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl({
      currentDateLabel: "Firstday, Dawn 1, 100 AG",
      currentTurnNumber: 0,
      nextDateLabel: "Secondday, Dawn 2, 100 AG",
      nextTurnNumber: 1,
    });

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Confirm end turn",
    });

    expect(dialog).toHaveTextContent("Current turn");
    expect(dialog).toHaveTextContent("Next turn");
    expect(within(dialog).getByText("0")).toBeDefined();
    expect(within(dialog).getByText("1")).toBeDefined();
    expect(screen.queryByText("Turn 0")).toBeNull();
    expect(screen.queryByText("Turn 1")).toBeNull();
    expect(screen.getByText("Firstday, Dawn 1, 100 AG")).toBeDefined();
    expect(screen.getByText("Secondday, Dawn 2, 100 AG")).toBeDefined();
  });

  it("warns about not-ready settlements without blocking confirmation", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({ auto_ready_enabled: true }),
        createSettlementRow({ id: "settlement-2" }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));

    expect(await screen.findByText("Readiness summary")).toBeDefined();
    expect(screen.getByText(/1 of 2 settlements ready/i)).toBeDefined();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /some settlements are not ready/i,
    );

    await user.click(screen.getByRole("button", { name: "Confirm end turn" }));

    expect(clientFixture.invoke).toHaveBeenCalledTimes(1);
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
    await user.click(
      await screen.findByRole("button", { name: "Confirm end turn" }),
    );

    expect(
      (await screen.findAllByRole("button", { name: "Ending turn..." }))[0],
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
      await screen.findByRole("button", { name: "Confirm end turn" }),
    );
    await user.click(
      (await screen.findAllByRole("button", { name: "Ending turn..." }))[0],
    );

    expect(clientFixture.invoke).toHaveBeenCalledTimes(1);
  });

  it("shows successful transition details after ending the turn", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: {
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
      settlementRows: [
        createSettlementRow({ auto_ready_enabled: true }),
        createSettlementRow({
          id: "settlement-2",
          is_ready_current_turn: true,
        }),
      ],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));
    await user.click(
      await screen.findByRole("button", { name: "Confirm end turn" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "End-turn transition completed.",
    );
    expect(screen.getByText("Previous turn")).toBeDefined();
    expect(screen.getByText("New turn")).toBeDefined();
    expect(screen.getAllByText("Turn 7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Turn 8").length).toBeGreaterThan(0);
    expect(screen.getByText("Previous date")).toBeDefined();
    expect(screen.getByText("Firstday, Dawn 2, 101 AG")).toBeDefined();
    expect(screen.getByText("New date")).toBeDefined();
    expect(screen.getByText("Secondday, Ember 1, 101 AG")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a refresh-safe message for stale-turn failures", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "end_turn_stale_expected_turn",
        message: "Internal stale detail",
      }),
      settlementRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));
    await user.click(
      await screen.findByRole("button", { name: "Confirm end turn" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This turn has already changed. Refresh the page to review the latest world state.",
    );
    expect(screen.queryByText("Internal stale detail")).toBeNull();
  });

  it("shows a safe message for unauthorized failures", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "unauthorized",
        message: "Internal authorization detail",
      }),
      settlementRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));
    await user.click(
      await screen.findByRole("button", { name: "Confirm end turn" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "End turn is unavailable for this world.",
    );
    expect(screen.queryByText("Internal authorization detail")).toBeNull();
  });

  it("shows a safe message for transition persistence failures", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "end_turn_transition_failed",
        message: "Internal transition detail",
      }),
      settlementRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(await screen.findByRole("button", { name: "End turn" }));
    await user.click(
      await screen.findByRole("button", { name: "Confirm end turn" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "End turn could not be saved. Refresh the page before trying again.",
    );
    expect(screen.queryByText("Internal transition detail")).toBeNull();
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
      <EndTurnControl
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

function createFunctionErrorResult({
  code,
  message,
}: {
  readonly code: string;
  readonly message: string;
}): FunctionInvokeResult {
  return {
    data: {
      error: {
        code,
        message,
      },
      ok: false,
    },
    error: null,
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
