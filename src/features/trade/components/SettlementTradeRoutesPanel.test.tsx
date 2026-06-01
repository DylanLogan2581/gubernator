import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementTradeRoutesPanel } from "./SettlementTradeRoutesPanel";

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
const CITIZEN_ID_1 = "00000000-0000-0000-0000-000000000040";

type TestTradeRouteRow = {
  readonly id: string;
  readonly origin_settlement_id: string;
  readonly destination_settlement_id: string;
  readonly resource_id: string;
  readonly quantity_per_transition: number;
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
  readonly resource: { readonly name: string };
};

function createRouteRow(
  overrides: Partial<TestTradeRouteRow> = {},
): TestTradeRouteRow {
  return {
    id: ROUTE_ID_1,
    origin_settlement_id: SETTLEMENT_ID,
    destination_settlement_id: DEST_SETTLEMENT_ID,
    resource_id: RESOURCE_ID_1,
    quantity_per_transition: 10,
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
    resource: { name: "Grain" },
    ...overrides,
  };
}

type TestAssignmentRow = {
  readonly citizen_id: string;
  readonly assignment_type: string;
  readonly job_id: null;
  readonly construction_project_id: null;
  readonly deposit_instance_id: null;
  readonly managed_population_instance_id: null;
  readonly trade_route_id: string | null;
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
    job_id: null,
    construction_project_id: null,
    deposit_instance_id: null,
    managed_population_instance_id: null,
    trade_route_id: ROUTE_ID_1,
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

function createClient({
  routeRows = [],
  assignmentRows = [],
  settlementRows = [],
  resourceRows = [],
  rpcMock,
}: {
  readonly routeRows?: readonly TestTradeRouteRow[];
  readonly assignmentRows?: readonly TestAssignmentRow[];
  readonly settlementRows?: readonly TestSettlementRow[];
  readonly resourceRows?: readonly TestResourceRow[];
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
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock ?? vi.fn(),
  };
}

function renderPanel(
  props: Partial<{
    canAdmin: boolean;
    canManage: boolean;
    isArchived: boolean;
    nationId: string;
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
        canAdmin={props.canAdmin ?? false}
        canManage={props.canManage ?? false}
        isArchived={props.isArchived ?? false}
        nationId={props.nationId ?? NATION_ID}
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
    requireSupabaseClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "trade_routes")
          return { select: vi.fn(() => routesSelectBuilder) };
        if (table === "citizen_assignments")
          return { select: vi.fn(() => assignmentsSelectBuilder) };
        throw new Error(`Unexpected: ${table}`);
      }),
      rpc: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText("Loading trade routes…")).toBeDefined();
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
    expect(screen.getByText("Grain")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
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

    renderPanel({ canAdmin: false });

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

    renderPanel({ canAdmin: false });

    await screen.findByText("No trade routes");
    expect(
      screen.getByRole("button", { name: "Propose trade route" }),
    ).toBeDefined();
  });

  it("hides propose button from non-managers", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ routeRows: [] }));

    renderPanel({ canAdmin: false });

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

    renderPanel({ canAdmin: false, isArchived: true });

    await screen.findByText("No trade routes");
    expect(
      screen.queryByRole("button", { name: "Propose trade route" }),
    ).toBeNull();
  });

  it("shows approve/reject buttons on proposed routes for managers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [
          createRouteRow({
            status: "proposed",
            origin_settlement_id: SETTLEMENT_ID,
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

    await screen.findByText("Outgoing (1)");
    expect(
      screen.getByRole("button", {
        name: "Approve trade route with Far Settlement (Far Nation)",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", {
        name: "Reject trade route with Far Settlement (Far Nation)",
      }),
    ).toBeDefined();
  });

  it("hides approve/reject buttons from non-managers", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        routeRows: [createRouteRow({ status: "proposed" })],
      }),
    );

    renderPanel({ canAdmin: false });

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
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
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
            status: "proposed",
            origin_settlement_id: SETTLEMENT_ID,
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

    renderPanel();

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Approve trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Approve trade route?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "approve_trade_route_side",
        expect.objectContaining({
          p_route_id: ROUTE_ID_1,
          p_approver_citizen_id: CITIZEN_ID_1,
          p_side: "origin",
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
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
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
            status: "proposed",
            origin_settlement_id: SETTLEMENT_ID,
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

    renderPanel();

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Approve trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
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
            status: "proposed",
            origin_settlement_id: SETTLEMENT_ID,
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

    renderPanel();

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Reject trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Reject trade route?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "reject_trade_route_side",
        expect.objectContaining({
          p_route_id: ROUTE_ID_1,
          p_rejector_citizen_id: CITIZEN_ID_1,
          p_side: "origin",
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

    renderPanel();

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Cancel trade route with Far Settlement (Far Nation)",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
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

    renderPanel();

    await screen.findByText("Outgoing (1)");
    await user.click(
      screen.getByRole("button", {
        name: "Cancel trade route with Far Settlement (Far Nation)",
      }),
    );

    await screen.findByRole("dialog", { name: "Cancel trade route?" });
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

    renderPanel();

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

    const resourceSelect = within(dialog).getByRole("combobox", {
      name: "Resource",
    });
    await user.selectOptions(resourceSelect, RESOURCE_ID_1);

    const qtyInput = within(dialog).getByRole("textbox", {
      name: "Quantity per turn",
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
          p_resource_id: RESOURCE_ID_1,
          p_quantity: 25,
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
    const rpcMock = vi.fn((fn: string) => {
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

    renderPanel();

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
      name: "New quantity per turn",
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
      ([fn]: [string]) => fn === "replace_trade_route",
    );
    expect(
      (
        replaceCall?.[1] as {
          p_new_payload?: { quantity_per_transition?: number };
        }
      )?.p_new_payload?.quantity_per_transition,
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

    renderPanel();

    await screen.findByText("Incoming (1)");
    expect(
      screen.getByRole("button", {
        name: "Approve trade route with Far Settlement (Far Nation)",
      }),
    ).toBeDefined();
  });
});
