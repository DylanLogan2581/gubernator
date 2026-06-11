import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementTradeRoutesPanel } from ".";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const { useActivePlayerCharacter } = vi.hoisted(() => ({
  useActivePlayerCharacter: vi.fn<
    () => {
      activeCharacter: {
        id: string;
        roleType: string;
        roleNationId: string | null;
        roleSettlementId: string | null;
        status: string;
      } | null;
    }
  >(),
}));

vi.mock("@/features/permissions", async () => {
  const actual = await vi.importActual("@/features/permissions");
  return {
    ...actual,
    useActivePlayerCharacter,
  };
});

const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000001";
const NATION_ID = "00000000-0000-0000-0000-000000000002";
const WORLD_ID = "00000000-0000-0000-0000-000000000003";
const ROUTE_ID_1 = "00000000-0000-0000-0000-000000000010";
const ROUTE_ID_2 = "00000000-0000-0000-0000-000000000011";
const DEST_SETTLEMENT_ID = "00000000-0000-0000-0000-000000000020";
const RESOURCE_ID_1 = "00000000-0000-0000-0000-000000000030";
const LEG_ID_1 = "00000000-0000-0000-0000-000000000031";
const CITIZEN_ID_1 = "00000000-0000-0000-0000-000000000040";

type TestTradeRouteLegRow = {
  readonly id: string;
  readonly direction: string;
  readonly resource_id: string;
  readonly quantity_per_transition: number;
  readonly resource: { readonly name: string };
};

type TestTradeRouteRow = {
  readonly id: string;
  readonly origin_settlement_id: string;
  readonly destination_settlement_id: string;
  readonly trade_route_legs: readonly TestTradeRouteLegRow[];
  readonly status: string;
  readonly proposed_by_citizen_id: string;
  readonly origin_approval_status: string;
  readonly destination_approval_status: string;
  readonly origin_approved_by_citizen_id: string | null;
  readonly destination_approved_by_citizen_id: string | null;
  readonly replacement_for_trade_route_id: string | null;
  readonly pause_reason_last_transition: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly origin_settlement: {
    readonly name: string;
    readonly nation: { readonly name: string };
  };
  readonly destination_settlement: {
    readonly name: string;
    readonly nation: { readonly name: string };
  };
};

function createRouteRow(
  overrides: Partial<TestTradeRouteRow> = {},
): TestTradeRouteRow {
  return {
    id: ROUTE_ID_1,
    origin_settlement_id: SETTLEMENT_ID,
    destination_settlement_id: DEST_SETTLEMENT_ID,
    trade_route_legs: [
      {
        id: LEG_ID_1,
        direction: "send",
        resource_id: RESOURCE_ID_1,
        quantity_per_transition: 10,
        resource: { name: "Grain" },
      },
    ],
    status: "proposed",
    proposed_by_citizen_id: CITIZEN_ID_1,
    origin_approval_status: "pending",
    destination_approval_status: "pending",
    origin_approved_by_citizen_id: null,
    destination_approved_by_citizen_id: null,
    replacement_for_trade_route_id: null,
    pause_reason_last_transition: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    origin_settlement: {
      name: "Home Settlement",
      nation: { name: "Home Nation" },
    },
    destination_settlement: {
      name: "Far Settlement",
      nation: { name: "Far Nation" },
    },
    ...overrides,
  };
}

type TestAssignmentRow = {
  readonly citizen_id: string;
  readonly assignment_type: string;
  readonly job: null;
  readonly construction_project: null;
  readonly deposit_instance: null;
  readonly managed_population_instance: null;
  readonly trade_route: {
    readonly id: string;
    readonly trade_route_legs: readonly {
      readonly direction: string;
      readonly resource: { readonly name: string };
    }[];
    readonly origin: { readonly name: string };
    readonly destination: { readonly name: string };
  } | null;
  readonly trade_route_end: string | null;
  readonly assigned_on_turn_number: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly citizens: { readonly settlement_id: string };
};

function createAssignmentRow(
  overrides: Partial<TestAssignmentRow> = {},
): TestAssignmentRow {
  return {
    citizen_id: CITIZEN_ID_1,
    assignment_type: "trade_route",
    job: null,
    construction_project: null,
    deposit_instance: null,
    managed_population_instance: null,
    trade_route: {
      id: ROUTE_ID_1,
      trade_route_legs: [{ direction: "send", resource: { name: "Grain" } }],
      origin: { name: "Home Settlement" },
      destination: { name: "Far Settlement" },
    },
    trade_route_end: "origin",
    assigned_on_turn_number: 1,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    citizens: { settlement_id: SETTLEMENT_ID },
    ...overrides,
  };
}

type TestSettlementRow = {
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly nations: { readonly name: string };
};

function createSettlementRow(
  overrides: Partial<TestSettlementRow> = {},
): TestSettlementRow {
  return {
    id: DEST_SETTLEMENT_ID,
    name: "Far Settlement",
    nation_id: "00000000-0000-0000-0000-000000000099",
    nations: { name: "Far Nation" },
    ...overrides,
  };
}

type TestResourceRow = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly world_id: string;
  readonly is_trashed: boolean;
  readonly is_system_resource: boolean;
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly updated_at: string;
};

function createResourceRow(
  overrides: Partial<TestResourceRow> = {},
): TestResourceRow {
  return {
    id: RESOURCE_ID_1,
    name: "Grain",
    slug: "grain",
    world_id: WORLD_ID,
    is_trashed: false,
    is_system_resource: false,
    base_stockpile_cap: 100,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

type TestTransitionRow = {
  readonly id: string;
  readonly world_id: string;
  readonly from_turn_number: number;
  readonly to_turn_number: number;
  readonly status: string;
  readonly started_at: string;
  readonly finished_at: string | null;
  readonly turn_log_entries: {
    readonly id: string;
    readonly settlement_id: string | null;
    readonly world_id: string;
    readonly citizen_id: string | null;
    readonly nation_id: string | null;
    readonly resource_id: string | null;
    readonly log_category: string;
    readonly payload_jsonb: unknown;
  }[];
  readonly notifications: unknown[];
  readonly settlement_turn_resource_snapshots: unknown[];
  readonly settlement_turn_snapshots: unknown[];
};

function createTransitionRow(
  logEntries: TestTransitionRow["turn_log_entries"] = [],
): TestTransitionRow {
  return {
    id: "00000000-0000-0000-0000-000000000099",
    world_id: WORLD_ID,
    from_turn_number: 1,
    to_turn_number: 2,
    status: "completed",
    started_at: "2026-06-01T00:00:00.000Z",
    finished_at: "2026-06-01T00:01:00.000Z",
    turn_log_entries: logEntries,
    notifications: [],
    settlement_turn_resource_snapshots: [],
    settlement_turn_snapshots: [],
  };
}

function createClient({
  routeRows = [],
  assignmentRows = [],
  settlementRows = [],
  resourceRows = [],
  transitionRow,
  rpcMock,
}: {
  readonly routeRows?: readonly TestTradeRouteRow[];
  readonly assignmentRows?: readonly TestAssignmentRow[];
  readonly settlementRows?: readonly TestSettlementRow[];
  readonly resourceRows?: readonly TestResourceRow[];
  readonly transitionRow?: TestTransitionRow | null;
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): unknown {
  const routesSelectBuilder: Record<string, unknown> = {
    or: vi.fn(() => routesSelectBuilder),
    order: vi.fn(() => routesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: routeRows, error: null }),
  };

  const assignmentsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => assignmentsSelectBuilder),
    in: vi.fn(() => assignmentsSelectBuilder),
    order: vi.fn(() => assignmentsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: assignmentRows, error: null }),
  };

  const settlementsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => settlementsSelectBuilder),
    order: vi.fn(() => settlementsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: settlementRows, error: null }),
  };

  const resourcesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => resourcesSelectBuilder),
    order: vi.fn(() => resourcesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: resourceRows, error: null }),
  };

  const resolvedTransition = transitionRow !== undefined ? transitionRow : null;
  const transitionsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => transitionsSelectBuilder),
    order: vi.fn(() => transitionsSelectBuilder),
    limit: vi.fn(() => transitionsSelectBuilder),
    returns: vi.fn(() => transitionsSelectBuilder),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: resolvedTransition, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "trade_routes") {
        return { select: vi.fn(() => routesSelectBuilder) };
      }
      if (table === "citizen_assignments") {
        return { select: vi.fn(() => assignmentsSelectBuilder) };
      }
      if (table === "settlements") {
        return { select: vi.fn(() => settlementsSelectBuilder) };
      }
      if (table === "resources") {
        return { select: vi.fn(() => resourcesSelectBuilder) };
      }
      if (table === "turn_transitions") {
        return { select: vi.fn(() => transitionsSelectBuilder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock ?? vi.fn(),
  };
}

function renderPanel(
  props: Partial<{
    canManage: boolean;
    isArchived: boolean;
    settlementId: string;
    worldId: string;
  }> = {},
): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <SettlementTradeRoutesPanel
        canManage={props.canManage ?? false}
        isArchived={props.isArchived ?? false}
        settlementId={props.settlementId ?? SETTLEMENT_ID}
        worldId={props.worldId ?? WORLD_ID}
      />
    </QueryClientProvider>,
  );
}

describe("SettlementTradeRoutesPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    useActivePlayerCharacter.mockReturnValue({ activeCharacter: null });
  });

  it("renders loading state while fetching", () => {
    const neverResolving = new Promise(() => {});
    const routesSelectBuilder: Record<string, unknown> = {
      or: vi.fn(() => routesSelectBuilder),
      order: vi.fn(() => routesSelectBuilder),
      returns: vi.fn().mockReturnValue(neverResolving),
    };
    const assignmentsSelectBuilder: Record<string, unknown> = {
      eq: vi.fn(() => assignmentsSelectBuilder),
      in: vi.fn(() => assignmentsSelectBuilder),
      order: vi.fn(() => assignmentsSelectBuilder),
      returns: vi.fn().mockReturnValue(neverResolving),
    };
    const transitionsSelectBuilder: Record<string, unknown> = {
      eq: vi.fn(() => transitionsSelectBuilder),
      order: vi.fn(() => transitionsSelectBuilder),
      limit: vi.fn(() => transitionsSelectBuilder),
      maybeSingle: vi.fn().mockReturnValue(neverResolving),
    };
    requireSupabaseClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "trade_routes")
          return { select: vi.fn(() => routesSelectBuilder) };
        if (table === "citizen_assignments")
          return { select: vi.fn(() => assignmentsSelectBuilder) };
        if (table === "turn_transitions")
          return { select: vi.fn(() => transitionsSelectBuilder) };
        throw new Error(`Unexpected: ${table}`);
      }),
      rpc: vi.fn(),
    });

    renderPanel();

    expect(screen.getByRole("status", { name: "Loading table" })).toBeDefined();
  });

  it("renders empty state when no routes", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ routeRows: [] }));

    renderPanel();

    expect(await screen.findByText("No trade routes")).toBeDefined();
  });

  it("displays outgoing route with destination and resource", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            origin_settlement_id: SETTLEMENT_ID,
            destination_settlement_id: DEST_SETTLEMENT_ID,
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    expect(screen.getByText("Far Settlement (Far Nation)")).toBeDefined();
    expect(screen.getByText(/Grain/)).toBeDefined();
    expect(screen.getByText("Proposed")).toBeDefined();
  });

  it("displays incoming route with origin info", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            id: ROUTE_ID_2,
            origin_settlement_id: DEST_SETTLEMENT_ID,
            destination_settlement_id: SETTLEMENT_ID,
            origin_settlement: {
              name: "Far Settlement",
              nation: { name: "Far Nation" },
            },
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Incoming (1)");
    expect(screen.getByText("Far Settlement (Far Nation)")).toBeDefined();
  });

  it("shows propose button for nation managers", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ routeRows: [] }));
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("No trade routes");
    expect(
      screen.getByRole("button", { name: "Propose trade route" }),
    ).toBeDefined();
  });

  it("shows propose button for settlement managers", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ routeRows: [] }));
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "settlement_manager",
        roleNationId: null,
        roleSettlementId: SETTLEMENT_ID,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("No trade routes");
    expect(
      screen.getByRole("button", { name: "Propose trade route" }),
    ).toBeDefined();
  });

  it("hides propose button from non-managers", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ routeRows: [] }));

    renderPanel({ canManage: false });

    await screen.findByText("No trade routes");
    expect(
      screen.queryByRole("button", { name: "Propose trade route" }),
    ).toBeNull();
  });

  it("hides propose button when archived", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ routeRows: [] }));
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true, isArchived: true });

    await screen.findByText("No trade routes");
    expect(
      screen.queryByRole("button", { name: "Propose trade route" }),
    ).toBeNull();
  });

  it("shows approve/reject on outgoing route when the origin side is the pending recipient", async () => {
    // Approval is role-based, not direction-based: when this settlement is the
    // origin and its side is still pending (e.g. the route was proposed by the
    // other endpoint's manager), the origin manager is the recipient and must be
    // able to approve/reject from the outgoing view.
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "proposed",
            origin_settlement_id: SETTLEMENT_ID,
            origin_approval_status: "pending",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Outgoing (1)");
    expect(
      screen.queryByRole("button", {
        name: /Approve trade route/,
      }),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /Reject trade route/,
      }),
    ).not.toBeNull();
  });

  it("hides approve/reject for outgoing route when proposer's origin side is auto-approved", async () => {
    // After propose_trade_route auto-approves the proposer's side, origin_approval_status
    // becomes 'approved'. The proposer's settlement view should only show Cancel.
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "proposed",
            origin_settlement_id: SETTLEMENT_ID,
            origin_approval_status: "approved",
            destination_approval_status: "pending",
          }),
        ],
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Outgoing (1)");
    expect(
      screen.queryByRole("button", { name: /Approve trade route/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Reject trade route/ }),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Cancel trade route with Far Settlement (Far Nation)",
      }),
    ).toBeDefined();
  });

  it("hides approve/reject buttons from non-managers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [createRouteRow({ status: "proposed" })],
      }),
    );

    renderPanel({ canManage: false });

    await screen.findByText("Outgoing (1)");
    expect(
      screen.queryByRole("button", {
        name: /Approve trade route/,
      }),
    ).toBeNull();
  });

  it("approve flow — calls RPC and shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "approve_trade_route_side") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID_1,
              origin_settlement_id: DEST_SETTLEMENT_ID,
              destination_settlement_id: SETTLEMENT_ID,
              status: "proposed",
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            id: ROUTE_ID_2,
            status: "proposed",
            origin_settlement_id: DEST_SETTLEMENT_ID,
            destination_settlement_id: SETTLEMENT_ID,
            origin_settlement: {
              name: "Far Settlement",
              nation: { name: "Far Nation" },
            },
          }),
        ],
        rpcMock,
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "settlement_manager",
        roleNationId: null,
        roleSettlementId: SETTLEMENT_ID,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Incoming (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Approve trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Approve trade route?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "approve_trade_route_side",
        expect.objectContaining({
          p_route_id: ROUTE_ID_2,
          p_approver_citizen_id: CITIZEN_ID_1,
          p_side: "destination",
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route side approved.",
        undefined,
      );
    });
  });

  it("approve shows 'now active' toast when result status is active", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "approve_trade_route_side") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID_1,
              origin_settlement_id: DEST_SETTLEMENT_ID,
              destination_settlement_id: SETTLEMENT_ID,
              status: "active",
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            id: ROUTE_ID_2,
            status: "proposed",
            origin_settlement_id: DEST_SETTLEMENT_ID,
            destination_settlement_id: SETTLEMENT_ID,
            origin_settlement: {
              name: "Far Settlement",
              nation: { name: "Far Nation" },
            },
          }),
        ],
        rpcMock,
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "settlement_manager",
        roleNationId: null,
        roleSettlementId: SETTLEMENT_ID,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Incoming (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Approve trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Approve trade route?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route approved and now active.",
        undefined,
      );
    });
  });

  it("reject flow — calls RPC and shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "reject_trade_route_side") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID_1,
              origin_settlement_id: DEST_SETTLEMENT_ID,
              destination_settlement_id: SETTLEMENT_ID,
              status: "cancelled",
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            id: ROUTE_ID_2,
            status: "proposed",
            origin_settlement_id: DEST_SETTLEMENT_ID,
            destination_settlement_id: SETTLEMENT_ID,
            origin_settlement: {
              name: "Far Settlement",
              nation: { name: "Far Nation" },
            },
          }),
        ],
        rpcMock,
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "settlement_manager",
        roleNationId: null,
        roleSettlementId: SETTLEMENT_ID,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Incoming (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Reject trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Reject trade route?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "reject_trade_route_side",
        expect.objectContaining({
          p_route_id: ROUTE_ID_2,
          p_rejector_citizen_id: CITIZEN_ID_1,
          p_side: "destination",
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route rejected.",
        undefined,
      );
    });
  });

  it("cancel flow — calls RPC and shows trader count in toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "cancel_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID_1,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
              status: "cancelled",
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
        assignmentRows: [createAssignmentRow(), createAssignmentRow()],
        rpcMock,
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Cancel trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("alertdialog", {
      name: "Cancel trade route?",
    });
    expect(within(dialog).getByText(/2 traders/)).toBeDefined();

    await user.click(
      within(dialog).getByRole("button", { name: "Cancel route" }),
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "cancel_trade_route",
        expect.objectContaining({ p_route_id: ROUTE_ID_1 }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route cancelled. 2 traders were unassigned.",
        undefined,
      );
    });
  });

  it("cancel with no traders shows plain success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "cancel_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID_1,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
              status: "cancelled",
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [createRouteRow({ status: "proposed" })],
        assignmentRows: [],
        rpcMock,
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Cancel trade route with Far Settlement (Far Nation)",
      }),
    );

    await screen.findByRole("alertdialog", { name: "Cancel trade route?" });
    await user.click(screen.getByRole("button", { name: "Cancel route" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route cancelled.",
        undefined,
      );
    });
  });

  it("propose flow — opens dialog, submits, shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "propose_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID_1,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [],
        settlementRows: [createSettlementRow()],
        resourceRows: [createResourceRow()],
        rpcMock,
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("No trade routes");
    await user.click(
      screen.getByRole("button", { name: "Propose trade route" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });

    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    const resourceSelect = await within(dialog).findByRole("combobox", {
      name: "Leg 1 resource",
    });
    await user.selectOptions(resourceSelect, RESOURCE_ID_1);

    const qtyInput = within(dialog).getByRole("textbox", {
      name: "Leg 1 quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "25");

    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "propose_trade_route",
        expect.objectContaining({
          p_origin: SETTLEMENT_ID,
          p_destination: DEST_SETTLEMENT_ID,
          p_legs: [
            { direction: "send", quantity: 25, resource_id: RESOURCE_ID_1 },
          ],
          p_proposed_by_citizen_id: CITIZEN_ID_1,
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route proposed.",
        undefined,
      );
    });
  });

  it("replace flow — opens dialog, submits, shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string, _params?: unknown) => {
      if (fn === "replace_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              old_route_id: ROUTE_ID_1,
              new_route_id: ROUTE_ID_2,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
        rpcMock,
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Replace trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Replace trade route",
    });

    const qtyInput = within(dialog).getByRole("textbox", {
      name: "Leg 1 quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "20");

    await user.click(within(dialog).getByRole("button", { name: "Replace" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "replace_trade_route",
        expect.objectContaining({
          p_old_id: ROUTE_ID_1,
          p_proposing_citizen_id: CITIZEN_ID_1,
        }),
      );
    });
    const replaceCall = rpcMock.mock.calls.find(
      ([fn]) => fn === "replace_trade_route",
    );
    expect(
      (
        replaceCall?.[1] as {
          p_new_payload?: { legs?: { quantity?: number }[] };
        }
      )?.p_new_payload?.legs?.[0]?.quantity,
    ).toBe(20);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route replaced. New proposal pending approval.",
        undefined,
      );
    });
  });

  it("incoming route shows destination side approve button", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            id: ROUTE_ID_2,
            status: "proposed",
            origin_settlement_id: DEST_SETTLEMENT_ID,
            destination_settlement_id: SETTLEMENT_ID,
            origin_settlement: {
              name: "Far Settlement",
              nation: { name: "Far Nation" },
            },
          }),
        ],
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "settlement_manager",
        roleNationId: null,
        roleSettlementId: SETTLEMENT_ID,
        status: "alive",
      },
    });

    renderPanel({ canManage: true });

    await screen.findByText("Incoming (1)");
    expect(
      screen.getByRole("button", {
        name: "Approve trade route with Far Settlement (Far Nation)",
      }),
    ).toBeDefined();
  });

  it("shows pause reason tooltip on paused route status badge", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "paused",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
            pause_reason_last_transition: "insufficient_origin_stock",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    const badge = screen.getByTitle("Insufficient stock at origin");
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe("Paused");
  });

  it("shows destination space tooltip on paused route with destination space reason", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "paused",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
            pause_reason_last_transition: "insufficient_destination_space",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    expect(
      screen.getByTitle("Insufficient space at destination"),
    ).toBeDefined();
  });

  it("shows no tooltip on active route status badge", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    const badge = screen.getByText("Active");
    expect(badge.title).toBe("");
  });

  it("applies resumed highlight class to rows that resumed in the latest transition", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
        transitionRow: createTransitionRow([
          {
            id: "log-1",
            settlement_id: SETTLEMENT_ID,
            world_id: WORLD_ID,
            citizen_id: null,
            nation_id: null,
            resource_id: null,
            log_category: "trade_route.resumed",
            payload_jsonb: {
              destinationSettlementId: DEST_SETTLEMENT_ID,
              quantityTransferred: 10,
              resourceId: RESOURCE_ID_1,
              tradeRouteId: ROUTE_ID_1,
            },
          },
        ]),
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    const row = document.getElementById(`trade-route-${ROUTE_ID_1}`);
    expect(row?.className).toContain("animate-pulse");
  });

  it("shows sr-only 'resumed this turn' label on resumed rows", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
        transitionRow: createTransitionRow([
          {
            id: "log-1",
            settlement_id: SETTLEMENT_ID,
            world_id: WORLD_ID,
            citizen_id: null,
            nation_id: null,
            resource_id: null,
            log_category: "trade_route.resumed",
            payload_jsonb: {
              destinationSettlementId: DEST_SETTLEMENT_ID,
              quantityTransferred: 10,
              resourceId: RESOURCE_ID_1,
              tradeRouteId: ROUTE_ID_1,
            },
          },
        ]),
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    expect(screen.getByText("resumed this turn")).toBeDefined();
  });

  it("does not apply resumed highlight to routes not in latest transition log", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
        transitionRow: createTransitionRow([]),
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    const row = document.getElementById(`trade-route-${ROUTE_ID_1}`);
    expect(row?.className).not.toContain("animate-pulse");
  });

  it("hides cancelled and replaced routes by default", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
          createRouteRow({
            id: ROUTE_ID_2,
            status: "cancelled",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    expect(screen.queryByText("Cancelled")).toBeNull();
  });

  it("shows cancelled toggle with count after routes load", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({ status: "active" }),
          createRouteRow({
            id: ROUTE_ID_2,
            status: "cancelled",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    expect(
      screen.getByRole("button", { name: "Show cancelled" }),
    ).toBeDefined();
  });

  it("toggling Cancelled tab reveals cancelled and replaced routes", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
          createRouteRow({
            id: ROUTE_ID_2,
            status: "cancelled",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");

    await user.click(screen.getByRole("button", { name: "Show cancelled" }));

    await screen.findByText("Outgoing (1)");
    expect(screen.getByText("Cancelled")).toBeDefined();
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("cancelled view is read-only — no approve/reject/cancel/replace buttons", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            id: ROUTE_ID_2,
            status: "cancelled",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel();

    await screen.findByRole("button", { name: "Show cancelled" });

    await user.click(screen.getByRole("button", { name: "Show cancelled" }));

    await screen.findByText("Outgoing (1)");
    expect(
      screen.queryByRole("button", { name: /Approve trade route/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Reject trade route/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Cancel trade route/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Replace trade route/ }),
    ).toBeNull();
  });

  it("cancelled view shows empty state when no cancelled routes", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "active",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");

    await user.click(screen.getByRole("button", { name: "Show cancelled" }));

    expect(await screen.findByText("No cancelled trade routes")).toBeDefined();
  });

  it("cancelled toggle button aria-pressed reflects visibility state", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({ status: "active" }),
          createRouteRow({
            id: ROUTE_ID_2,
            status: "cancelled",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );

    renderPanel();

    await screen.findByText("Outgoing (1)");
    const toggleBtn = screen.getByRole("button", { name: "Show cancelled" });
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");

    await user.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Hide cancelled" })).toBe(
      toggleBtn,
    );
  });

  it("propose button is hidden in cancelled view", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            id: ROUTE_ID_2,
            status: "cancelled",
            origin_approval_status: "approved",
            destination_approval_status: "approved",
          }),
        ],
      }),
    );
    useActivePlayerCharacter.mockReturnValue({
      activeCharacter: {
        id: CITIZEN_ID_1,
        roleType: "nation_manager",
        roleNationId: NATION_ID,
        roleSettlementId: null,
        status: "alive",
      },
    });

    renderPanel();

    await screen.findByRole("button", { name: "Show cancelled" });

    await user.click(screen.getByRole("button", { name: "Show cancelled" }));

    await screen.findByText("Outgoing (1)");
    expect(
      screen.queryByRole("button", { name: "Propose trade route" }),
    ).toBeNull();
  });
});
