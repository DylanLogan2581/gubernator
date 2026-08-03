import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProposeTradeRouteDialog } from "./ProposeTradeRouteDialog";

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

vi.mock("@/features/citizens/queries/citizensQueries", async () => {
  const actual = await vi.importActual(
    "@/features/citizens/queries/citizensQueries",
  );
  return {
    ...actual,
    citizenByIdQueryOptions: (citizenId: string) => ({
      queryFn: () =>
        Promise.resolve(
          citizenId === PICKED_CITIZEN_ID
            ? { id: citizenId, name: "Carol" }
            : null,
        ),
      queryKey: ["citizen-by-id", citizenId],
    }),
  };
});

vi.mock("@/features/citizens/queries/citizenDirectoryQueries", async () => {
  const actual = await vi.importActual(
    "@/features/citizens/queries/citizenDirectoryQueries",
  );
  return {
    ...actual,
    citizensDirectoryQueryOptions: () => ({
      queryFn: () =>
        Promise.resolve({
          rows: [{ id: PICKED_CITIZEN_ID, name: "Carol" }],
          totalCount: 1,
        }),
      queryKey: ["citizens-directory"],
    }),
  };
});

const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000001";
const DEST_SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const WORLD_ID = "00000000-0000-0000-0000-000000000003";
const ROUTE_ID = "00000000-0000-0000-0000-000000000010";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000030";
const CITIZEN_ID = "00000000-0000-0000-0000-000000000040";
const PICKED_CITIZEN_ID = "00000000-0000-0000-0000-000000000050";

const OWN_NATION_ID = "00000000-0000-0000-0000-000000000098";
const FAR_NATION_ID = "00000000-0000-0000-0000-000000000099";

const FAR_SETTLEMENT_ROW = {
  id: DEST_SETTLEMENT_ID,
  name: "Far Settlement",
  nation_id: FAR_NATION_ID,
  nations: { name: "Far Nation" },
};

const OWN_SETTLEMENT_ROW = {
  id: SETTLEMENT_ID,
  name: "Home Settlement",
  nation_id: OWN_NATION_ID,
  nations: { name: "Home Nation" },
};

function createNationRow(overrides: {
  readonly id: string;
  readonly name: string;
  readonly trade_policy: string;
}): Record<string, unknown> {
  return {
    capital_settlement_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    description: null,
    flag_path: null,
    founded_turn_number: null,
    government_type: "monarchy",
    nameset_id: null,
    tax_rate: 0,
    updated_at: "2026-06-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

const GRAIN_RESOURCE_ROW = {
  id: RESOURCE_ID,
  name: "Grain",
  slug: "grain",
  world_id: WORLD_ID,
  is_trashed: false,
  is_system_resource: false,
  base_stockpile_cap: 100,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

function createClient({
  settlementRows = [] as readonly unknown[],
  resourceRows = [] as readonly unknown[],
  nationRows = [] as readonly unknown[],
  nationRelationshipRow = null as Record<string, unknown> | null,
  rpcMock = vi.fn(),
}: {
  readonly settlementRows?: readonly unknown[];
  readonly resourceRows?: readonly unknown[];
  readonly nationRows?: readonly unknown[];
  readonly nationRelationshipRow?: Record<string, unknown> | null;
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): unknown {
  const settlementsBuilder: Record<string, unknown> = {
    eq: vi.fn(() => settlementsBuilder),
    order: vi.fn(() => settlementsBuilder),
    returns: vi.fn().mockResolvedValue({ data: settlementRows, error: null }),
  };
  const resourcesBuilder: Record<string, unknown> = {
    eq: vi.fn(() => resourcesBuilder),
    order: vi.fn(() => resourcesBuilder),
    returns: vi.fn().mockResolvedValue({ data: resourceRows, error: null }),
  };
  const nationsBuilder: Record<string, unknown> = {
    eq: vi.fn(() => nationsBuilder),
    order: vi.fn(() => nationsBuilder),
    returns: vi.fn().mockResolvedValue({ data: nationRows, error: null }),
  };
  const nationRelationshipsBuilder: Record<string, unknown> = {
    eq: vi.fn(() => nationRelationshipsBuilder),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: nationRelationshipRow, error: null }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "settlements")
        return { select: vi.fn(() => settlementsBuilder) };
      if (table === "resources")
        return { select: vi.fn(() => resourcesBuilder) };
      if (table === "nations") return { select: vi.fn(() => nationsBuilder) };
      if (table === "nation_relationships")
        return { select: vi.fn(() => nationRelationshipsBuilder) };
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock,
  };
}

function renderDialog({
  activeCharacterId = CITIZEN_ID,
  canManageNation = false,
  onClose = vi.fn<() => void>(),
  client = createClient(),
}: {
  readonly activeCharacterId?: string | null;
  readonly canManageNation?: boolean;
  readonly onClose?: () => void;
  readonly client?: unknown;
} = {}): { readonly onClose: () => void } {
  requireSupabaseClient.mockReturnValue(client);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ProposeTradeRouteDialog
        activeCharacterId={activeCharacterId}
        canManageNation={canManageNation}
        onClose={onClose}
        queryClient={queryClient}
        settlementId={SETTLEMENT_ID}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("ProposeTradeRouteDialog", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("renders the propose dialog", () => {
    renderDialog();
    expect(
      screen.getByRole("dialog", { name: "Propose trade route" }),
    ).toBeDefined();
  });

  it("happy path — submits and shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "propose_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    const { onClose } = renderDialog({
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        rpcMock,
      }),
    });

    const dialog = screen.getByRole("dialog", { name: "Propose trade route" });
    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    const resourceSelect = await within(dialog).findByRole("combobox", {
      name: "Leg 1 resource",
    });
    await user.selectOptions(resourceSelect, RESOURCE_ID);

    const qtyInput = within(dialog).getByRole("textbox", {
      name: "Leg 1 quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "25");

    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route proposed.",
        undefined,
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("validation — shows errors when fields are empty", async () => {
    const user = userEvent.setup();
    renderDialog({
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    expect(screen.getByText("Select a destination settlement.")).toBeDefined();
    expect(screen.getByText("Select a resource.")).toBeDefined();
    expect(
      screen.getByText("Quantity must be greater than zero."),
    ).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("error branch — shows error toast on RPC failure", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "propose_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "permission denied" },
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    renderDialog({
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        rpcMock,
      }),
    });

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
    await user.selectOptions(resourceSelect, RESOURCE_ID);

    const qtyInput = within(dialog).getByRole("textbox", {
      name: "Leg 1 quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "10");

    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("trade policy (#1087) — blocks and explains a closed destination nation", async () => {
    const user = userEvent.setup();
    renderDialog({
      client: createClient({
        settlementRows: [OWN_SETTLEMENT_ROW, FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        nationRows: [
          createNationRow({
            id: OWN_NATION_ID,
            name: "Home Nation",
            trade_policy: "free",
          }),
          createNationRow({
            id: FAR_NATION_ID,
            name: "Far Nation",
            trade_policy: "closed",
          }),
        ],
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    expect(
      await within(dialog).findByText(
        "Far Nation has closed its borders to trade.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Propose" }),
    ).toBeDisabled();
  });

  it("trade policy (#1087) — blocks a settlement manager from an external route when the home nation is state-controlled", async () => {
    const user = userEvent.setup();
    renderDialog({
      canManageNation: false,
      client: createClient({
        settlementRows: [OWN_SETTLEMENT_ROW, FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        nationRows: [
          createNationRow({
            id: OWN_NATION_ID,
            name: "Home Nation",
            trade_policy: "state_controlled",
          }),
          createNationRow({
            id: FAR_NATION_ID,
            name: "Far Nation",
            trade_policy: "free",
          }),
        ],
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    expect(
      await within(dialog).findByText(
        "Home Nation's trade is state-controlled — only a nation manager can propose external trade routes.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Propose" }),
    ).toBeDisabled();
  });

  it("trade policy (#1087) — allows a nation manager to propose despite state-controlled policy", async () => {
    const user = userEvent.setup();
    renderDialog({
      canManageNation: true,
      client: createClient({
        settlementRows: [OWN_SETTLEMENT_ROW, FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        nationRows: [
          createNationRow({
            id: OWN_NATION_ID,
            name: "Home Nation",
            trade_policy: "state_controlled",
          }),
          createNationRow({
            id: FAR_NATION_ID,
            name: "Far Nation",
            trade_policy: "free",
          }),
        ],
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Propose" }),
      ).toBeEnabled();
    });
  });

  it("diplomacy (#1088) — blocks and explains an at_war destination nation", async () => {
    const user = userEvent.setup();
    renderDialog({
      client: createClient({
        settlementRows: [OWN_SETTLEMENT_ROW, FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        nationRows: [
          createNationRow({
            id: OWN_NATION_ID,
            name: "Home Nation",
            trade_policy: "free",
          }),
          createNationRow({
            id: FAR_NATION_ID,
            name: "Far Nation",
            trade_policy: "free",
          }),
        ],
        nationRelationshipRow: {
          created_at: "2026-06-01T00:00:00.000Z",
          current_stance: "at_war",
          from_nation_id: OWN_NATION_ID,
          id: "00000000-0000-0000-0000-000000000200",
          pending_changed_by_citizen_id: null,
          pending_stance: null,
          pending_status: null,
          to_nation_id: FAR_NATION_ID,
          updated_at: "2026-06-01T00:00:00.000Z",
        },
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    expect(
      await within(dialog).findByText(
        "Home Nation and Far Nation are at war — trade routes cannot be proposed.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Propose" }),
    ).toBeDisabled();
  });

  it("admin (#1323) — shows a citizen picker and blocks submit until a citizen is chosen", async () => {
    const user = userEvent.setup();
    renderDialog({
      activeCharacterId: null,
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    expect(within(dialog).getByLabelText("Proposing citizen")).toBeDefined();

    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    expect(screen.getByText("Select a proposing citizen.")).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("admin (#1323) — proposes on behalf of a picked citizen", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "propose_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    renderDialog({
      activeCharacterId: null,
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        rpcMock,
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });

    await user.click(
      within(dialog).getByRole("combobox", { name: "Proposing citizen" }),
    );
    await user.click(await screen.findByText("Carol"));

    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    const resourceSelect = await within(dialog).findByRole("combobox", {
      name: "Leg 1 resource",
    });
    await user.selectOptions(resourceSelect, RESOURCE_ID);

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
          p_proposed_by_citizen_id: PICKED_CITIZEN_ID,
        }),
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      "Trade route proposed.",
      undefined,
    );
  });
});
