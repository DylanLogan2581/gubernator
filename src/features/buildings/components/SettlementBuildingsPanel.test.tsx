import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementBuildingsPanel } from "./SettlementBuildingsPanel";

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

const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000001";
const BUILDING_ID_1 = "00000000-0000-0000-0000-000000000010";
const BUILDING_ID_2 = "00000000-0000-0000-0000-000000000011";
const BLUEPRINT_ID = "00000000-0000-0000-0000-000000000020";
const TIER_ID = "00000000-0000-0000-0000-000000000030";

type TestBuildingRow = {
  readonly activated_on_turn_number: number;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly effects_json: ReadonlyArray<{
      readonly type: string;
      readonly amount: number;
      readonly jobId?: string;
      readonly resourceId?: string;
    }>;
    readonly tier_number: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly created_at: string;
  readonly current_tier_id: string;
  readonly deactivated_in_transition_id: null;
  readonly id: string;
  readonly missed_upkeep_count: number;
  readonly settlement_id: string;
  readonly source_project_id: null;
  readonly state: string;
  readonly updated_at: string;
};

function createBuildingRow(
  overrides: Partial<TestBuildingRow> = {},
): TestBuildingRow {
  return {
    activated_on_turn_number: 1,
    building_blueprint_id: BLUEPRINT_ID,
    building_blueprint_tiers: {
      effects_json: [{ amount: 5, type: "population_cap_increase" }],
      tier_number: 1,
    },
    building_blueprints: { name: "Barracks" },
    created_at: "2026-05-01T00:00:00.000Z",
    current_tier_id: TIER_ID,
    deactivated_in_transition_id: null,
    id: BUILDING_ID_1,
    missed_upkeep_count: 0,
    settlement_id: SETTLEMENT_ID,
    source_project_id: null,
    state: "active",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type TestCitizenRow = {
  readonly citizen_assignments: ReadonlyArray<{
    readonly assignment_type: string;
  }>;
  readonly citizen_type: string;
  readonly id: string;
  readonly status: string;
};

function createCitizenRow(
  overrides: Partial<TestCitizenRow> = {},
): TestCitizenRow {
  return {
    citizen_assignments: [],
    citizen_type: "npc",
    id: "00000000-0000-0000-0000-000000000099",
    status: "alive",
    ...overrides,
  };
}

function createClient({
  buildingRows = [],
  citizenRows = [],
  populationCap = 0,
  rpcMock,
}: {
  readonly buildingRows?: readonly TestBuildingRow[];
  readonly citizenRows?: readonly TestCitizenRow[];
  readonly populationCap?: number;
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): unknown {
  const buildingsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => buildingsSelectBuilder),
    order: vi.fn(() => buildingsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: buildingRows, error: null }),
  };

  const citizensSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => citizensSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: citizenRows, error: null }),
  };

  const defaultRpcMock = vi.fn((fn: string) => {
    if (fn === "settlement_population_cap") {
      return Promise.resolve({ data: populationCap, error: null });
    }
    throw new Error(`Unexpected RPC: ${fn}`);
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "settlement_buildings") {
        return { select: vi.fn(() => buildingsSelectBuilder) };
      }
      if (table === "citizens") {
        return { select: vi.fn(() => citizensSelectBuilder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock ?? defaultRpcMock,
  };
}

describe("SettlementBuildingsPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("displays population cap and citizen count from queries", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [],
        citizenRows: [
          createCitizenRow({ status: "alive" }),
          createCitizenRow({
            id: "00000000-0000-0000-0000-000000000098",
            status: "alive",
          }),
          createCitizenRow({
            id: "00000000-0000-0000-0000-000000000097",
            status: "dead",
          }),
        ],
        populationCap: 42,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText(/Population cap:/)).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
  });

  it("renders building rows grouped by state", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Barracks" },
            state: "active",
          }),
          createBuildingRow({
            building_blueprints: { name: "Granary" },
            id: BUILDING_ID_2,
            state: "suspended",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Barracks");
    expect(screen.getByText("Granary")).toBeDefined();
    expect(screen.getByText("Active (1)")).toBeDefined();
    expect(screen.getByText("Suspended (1)")).toBeDefined();
  });

  it("shows effects summary using tierEffectsToState formatting", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprint_tiers: {
              effects_json: [{ amount: 10, type: "population_cap_increase" }],
              tier_number: 1,
            },
          }),
        ],
        populationCap: 10,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Barracks");
    expect(screen.getByText("cap +10")).toBeDefined();
  });

  it("shows the deconstruct button for active buildings when admin", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Barracks" },
            state: "active",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Barracks");
    expect(
      screen.getByRole("button", { name: "Deconstruct Barracks" }),
    ).toBeDefined();
  });

  it("hides the deconstruct button from non-admin users (managers)", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Barracks" },
            state: "active",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Barracks");
    expect(
      screen.queryByRole("button", { name: "Deconstruct Barracks" }),
    ).toBeNull();
  });

  it("hides the deconstruct button when the world is archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Barracks" },
            state: "active",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: true });

    await screen.findByText("Barracks");
    expect(
      screen.queryByRole("button", { name: "Deconstruct Barracks" }),
    ).toBeNull();
  });

  it("opens confirm dialog when admin clicks deconstruct button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Barracks" },
            state: "active",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Barracks");
    await user.click(
      screen.getByRole("button", { name: "Deconstruct Barracks" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Deconstruct Barracks?" }),
    ).toBeDefined();
  });

  it("calls the deconstruct RPC and shows success toast on confirm", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "settlement_population_cap") {
        return Promise.resolve({ data: 5, error: null });
      }
      if (fn === "manual_deconstruct_settlement_building") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { settlement_building_id: BUILDING_ID_1 },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Barracks" },
            state: "active",
          }),
        ],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Barracks");
    await user.click(
      screen.getByRole("button", { name: "Deconstruct Barracks" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Deconstruct Barracks?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Deconstruct" }),
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "manual_deconstruct_settlement_building",
        { p_settlement_building_id: BUILDING_ID_1 },
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Building deconstructed.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("collapses a group when the toggle is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Barracks" },
            state: "active",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Barracks");
    const toggle = screen.getByRole("button", { name: /Active/ });
    await user.click(toggle);

    expect(screen.queryByText("Barracks")).toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("shows empty state when settlement has no buildings", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ buildingRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No buildings")).toBeDefined();
  });
});

function renderPanel({
  canAdmin,
  isArchived,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementBuildingsPanel
        canAdmin={canAdmin}
        isArchived={isArchived}
        settlementId={SETTLEMENT_ID}
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}
