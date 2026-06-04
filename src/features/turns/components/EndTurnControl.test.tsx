import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EndTurnControl } from "./EndTurnControl";

const { requireSupabaseClient, toastSuccess, toastError } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
  toastError: vi.fn<(message: string) => void>(),
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

describe("EndTurnControl", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
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
      await screen.findByRole("heading", { name: "Run turn transition" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Run the full simulation and advance the world from turn 7",
        {
          exact: false,
        },
      ),
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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Confirm turn transition" }),
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

    await user.click(
      screen.getByRole("button", { name: "Confirm turn transition" }),
    );

    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-simulation", {
      body: {
        expectedTurnNumber: 7,
        worldId: "world-1",
      },
    });
  });

  it("shows the transition checklist in the confirmation dialog", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Confirm turn transition",
    });

    expect(within(dialog).getByText("The transition will run:")).toBeDefined();
    expect(
      within(dialog).getByText("Jobs & resource production"),
    ).toBeDefined();
    expect(within(dialog).getByText("Construction progress")).toBeDefined();
    expect(within(dialog).getByText("Building upkeep")).toBeDefined();
    expect(within(dialog).getByText("Trade routes")).toBeDefined();
    expect(within(dialog).getByText("Homelessness")).toBeDefined();
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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Confirm turn transition",
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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

    expect(await screen.findByText("Readiness summary")).toBeDefined();
    expect(screen.getByText(/1 of 2 settlements ready/i)).toBeDefined();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /some settlements are not ready/i,
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm turn transition" }),
    );

    expect(clientFixture.invoke).toHaveBeenCalledTimes(1);
  });

  it("hides the control for non-admin users and cannot submit", () => {
    const clientFixture = createClientFixture({ settlementRows: [] });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl({ canAdmin: false });

    expect(
      screen.queryByRole("button", { name: "Run turn transition" }),
    ).toBeNull();
    expect(clientFixture.invoke).not.toHaveBeenCalled();
  });

  it("disables the control for archived worlds", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({ settlementRows: [] });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl({ isArchived: true });

    const button = await screen.findByRole("button", {
      name: "Run turn transition",
    });

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

    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    expect(
      (await screen.findAllByRole("button", { name: "Running..." }))[0],
    ).toBeDisabled();
    expect(screen.getByText("End-turn transition is running.")).toBeDefined();
    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-simulation", {
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

    const button = await screen.findByRole("button", {
      name: "Run turn transition",
    });

    await user.click(button);
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );
    await user.click(
      (await screen.findAllByRole("button", { name: "Running..." }))[0],
    );

    expect(clientFixture.invoke).toHaveBeenCalledTimes(1);
  });

  it("toasts the new turn and simulation counts after the transition", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: {
        data: {
          data: {
            actorId: "user-1",
            summary: {
              currentTurnNumber: 8,
              fromTurnNumber: 7,
              patchCounts: {
                citizenDeaths: 2,
                citizenBirths: 1,
                buildingStateChanges: 3,
                depositUpdates: 1,
              },
              toTurnNumber: 8,
              transitionId: "transition-1",
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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Advanced to turn 8", {
      description: "2 deaths, 1 births, 3 building changes, 1 deposit updates.",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("End-turn transition completed.")).toBeNull();
  });

  it("toasts simulation counts sourced from the response summary", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: {
        data: {
          data: {
            actorId: "user-1",
            summary: {
              currentTurnNumber: 8,
              fromTurnNumber: 7,
              patchCounts: {
                citizenDeaths: 5,
                citizenBirths: 3,
                buildingStateChanges: 2,
                depositUpdates: 4,
              },
              toTurnNumber: 8,
              transitionId: "transition-1",
            },
            worldId: "world-1",
          },
          ok: true,
        },
        error: null,
      },
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
    const [, options] = toastSuccess.mock.calls[0];

    expect(options?.description).toContain("5 deaths");
    expect(options?.description).toContain("3 births");
    expect(options?.description).toContain("2 building changes");
    expect(options?.description).toContain("4 deposit updates");
  });

  it("toasts an error message for stale-turn failures", async () => {
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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });
    expect(toastError).toHaveBeenCalledWith("Internal stale detail");
  });

  it("toasts an error message for unauthorized failures", async () => {
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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });
    expect(toastError).toHaveBeenCalledWith("Internal authorization detail");
  });

  it("toasts an error message for transition persistence failures", async () => {
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
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });
    expect(toastError).toHaveBeenCalledWith("Internal transition detail");
  });

  it("shows inline error in the dialog body after a mutation failure", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "end_turn_transition_failed",
        message: "Internal transition detail",
      }),
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });

    const dialog = screen.getByRole("dialog", {
      name: "Confirm turn transition",
    });
    expect(dialog).toBeDefined();
    expect(dialog).toHaveTextContent(
      "End turn could not be saved. Refresh the page before trying again.",
    );
  });

  it("shows the actual error message when the readiness query fails", async () => {
    const clientFixture = createClientFixture({
      settlementQueryError: new Error("Row-level security check failed"),
      settlementRows: [],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    expect(
      await screen.findByText("Row-level security check failed"),
    ).toBeDefined();
    expect(
      screen.getByText("End-turn readiness could not be loaded"),
    ).toBeDefined();
    expect(
      screen.queryByText(
        "Try refreshing the page. If the problem continues, contact an administrator.",
      ),
    ).toBeNull();
  });

  it("shows the specialized error message for mutation failures in the dialog", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "end_turn_transition_failed",
        message: "Internal transition detail",
      }),
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledTimes(1);
    });

    const dialog = screen.getByRole("dialog", {
      name: "Confirm turn transition",
    });
    expect(dialog).toHaveTextContent(
      "End turn could not be saved. Refresh the page before trying again.",
    );
    expect(dialog).not.toHaveTextContent("Internal transition detail");
  });

  it("closes the dialog when Escape is pressed", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Confirm turn transition" }),
    ).toBeDefined();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
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
        summary: {
          currentTurnNumber: 8,
          fromTurnNumber: 7,
          patchCounts: {
            citizenDeaths: 0,
            citizenBirths: 0,
            buildingStateChanges: 0,
            depositUpdates: 0,
          },
          toTurnNumber: 8,
          transitionId: "transition-1",
        },
        worldId: "world-1",
      },
      ok: true,
    },
    error: null,
  },
  settlementQueryError,
  settlementRows,
}: {
  readonly invokeResult?: FunctionInvokeResult;
  readonly settlementQueryError?: Error;
  readonly settlementRows: readonly TestSettlementReadinessRow[];
}): ClientFixture {
  const invoke = vi.fn().mockReturnValue(invokeResult);

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "settlements") {
          return createSettlementsQueryBuilder(
            settlementRows,
            settlementQueryError,
          );
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
  queryError?: Error,
): unknown {
  const resolvedValue =
    queryError !== undefined
      ? { data: null, error: { message: queryError.message } }
      : { data: rows, error: null };
  const builder = {
    eq: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue(resolvedValue),
    select: vi.fn(() => builder),
  };

  return builder;
}
