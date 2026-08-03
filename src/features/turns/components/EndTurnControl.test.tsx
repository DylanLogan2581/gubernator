import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EndTurnControl } from "./EndTurnControl";

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

describe("EndTurnControl", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    requireSupabaseClient.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("shows the current turn for admins", async () => {
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

    renderEndTurnControl();

    expect(
      await screen.findByRole("heading", { name: "Run turn transition" }),
    ).toBeDefined();
    expect(await screen.findByText("Current turn")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
  });

  it("floors uneven readiness percentages in confirmation copy", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      settlementRows: [
        createSettlementRow({
          auto_ready_enabled: true,
          is_ready_current_turn: true,
        }),
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
        createSettlementRow({
          auto_ready_enabled: true,
          is_ready_current_turn: true,
        }),
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
    expect(screen.getByText("Queueing the end-turn transition.")).toBeDefined();
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

  it("toasts that the turn was queued and closes the dialog", async () => {
    // The turn itself runs in a background worker now (#1278), so the request
    // reports acceptance; the outcome toast comes from the transition poll.
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
    await user.click(
      await screen.findByRole("button", { name: "Confirm turn transition" }),
    );

    await vi.waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccess).toHaveBeenCalledWith("Turn advancement started", {
      description:
        "The turn is running in the background. This page updates when it finishes.",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toasts an error message for stale-turn failures", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "end_turn_stale_expected_turn",
        message: "Internal stale detail",
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
      expect(
        screen.getByRole("dialog", {
          name: "Confirm turn transition",
        }),
      ).toHaveTextContent(
        "This turn has already changed. Refresh the page to review the latest world state.",
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("navigates to sign-in when the session has expired", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "session_expired",
        message: "Please sign in again.",
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
      expect(navigateMock).toHaveBeenCalledTimes(1);
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/sign-in",
      search: { returnTo: "/worlds/world-1/turns" },
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts an error message for unauthorized failures", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      invokeResult: createFunctionErrorResult({
        code: "unauthorized",
        message: "Internal authorization detail",
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
      expect(
        screen.getByRole("dialog", {
          name: "Confirm turn transition",
        }),
      ).toHaveTextContent("End turn is unavailable for this world.");
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts an error message for transition persistence failures", async () => {
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

    const dialog = screen.getByRole("dialog", {
      name: "Confirm turn transition",
    });
    expect(dialog).toBeDefined();
    expect(dialog).toHaveTextContent(
      "End turn could not be saved. Refresh the page before trying again.",
    );
    expect(toastError).not.toHaveBeenCalled();
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

    const dialog = screen.getByRole("dialog", {
      name: "Confirm turn transition",
    });
    expect(dialog).toBeDefined();
    expect(dialog).toHaveTextContent(
      "End turn could not be saved. Refresh the page before trying again.",
    );
    expect(toastError).not.toHaveBeenCalled();
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

    const dialog = screen.getByRole("dialog", {
      name: "Confirm turn transition",
    });
    expect(dialog).toHaveTextContent(
      "End turn could not be saved. Refresh the page before trying again.",
    );
    expect(dialog).not.toHaveTextContent("Internal transition detail");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows unready nations and requires the override checkbox before confirming", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      nationReadinessRows: [
        createNationReadinessRow({
          eligible_voter_count: 5,
          government_type: "republic",
          is_ready: false,
          nation_id: "nation-1",
          nation_name: "Republic Nation",
          readiness_mode: "office_majority",
          true_vote_count: 2,
        }),
      ],
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    expect(await screen.findByText("Nation readiness")).toBeDefined();
    expect(screen.getByText("Republic Nation")).toBeDefined();
    expect(screen.getByText("Republic — 2/5 senators voted")).toBeDefined();

    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Confirm turn transition",
    });
    expect(dialog).toHaveTextContent("1 nation not ready:");
    expect(dialog).toHaveTextContent("Republic — 2/5 senators voted");

    const confirmButton = screen.getByRole("button", {
      name: "Confirm turn transition",
    });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Advance anyway" }));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(clientFixture.invoke).toHaveBeenCalledWith("end-turn-simulation", {
      body: {
        expectedTurnNumber: 7,
        worldId: "world-1",
      },
    });
  });

  it("does not require an override for nations with no settlements", async () => {
    const user = userEvent.setup();
    const clientFixture = createClientFixture({
      nationReadinessRows: [
        createNationReadinessRow({
          eligible_voter_count: 0,
          has_settlements: false,
          is_ready: false,
          nation_id: "nation-empty",
          nation_name: "Empty Nation",
          true_vote_count: 0,
        }),
      ],
      settlementRows: [createSettlementRow({ auto_ready_enabled: true })],
    });
    requireSupabaseClient.mockReturnValue(clientFixture.client);

    renderEndTurnControl();

    await screen.findByText("Current turn");
    expect(screen.queryByText("Nation readiness")).toBeNull();

    await user.click(
      await screen.findByRole("button", { name: "Run turn transition" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Confirm turn transition",
    });
    expect(dialog).not.toHaveTextContent("Empty Nation");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Confirm turn transition" }),
    ).toBeEnabled();
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
type TestNationReadinessRow = {
  readonly eligible_voter_count: number;
  readonly government_type: string;
  readonly has_settlements: boolean;
  readonly is_ready: boolean;
  readonly nation_id: string;
  readonly nation_name: string;
  readonly readiness_mode: string;
  readonly true_vote_count: number;
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
        jobId: "job-1",
        transitionId: "transition-1",
        worldId: "world-1",
      },
      ok: true,
    },
    error: null,
  },
  nationReadinessRows = [],
  settlementQueryError,
  settlementRows,
}: {
  readonly invokeResult?: FunctionInvokeResult;
  readonly nationReadinessRows?: readonly TestNationReadinessRow[];
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

        // Return empty builder for turn_transitions to avoid errors
        return createTurnTransitionsQueryBuilder();
      }),
      functions: {
        invoke,
      },
      rpc: vi.fn(() =>
        Promise.resolve({ data: nationReadinessRows, error: null }),
      ),
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

function createNationReadinessRow(
  overrides: Partial<TestNationReadinessRow> = {},
): TestNationReadinessRow {
  return {
    eligible_voter_count: 1,
    government_type: "monarchy",
    has_settlements: true,
    is_ready: true,
    nation_id: "nation-1",
    nation_name: "Nation One",
    readiness_mode: "ruler_only",
    true_vote_count: 1,
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

function createTurnTransitionsQueryBuilder(): unknown {
  // Return null for turn transitions (no running transition in test)
  const builder = {
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    order: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  return builder;
}
