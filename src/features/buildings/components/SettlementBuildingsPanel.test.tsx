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
const WORLD_ID = "00000000-0000-0000-0000-000000000002";
const BUILDING_ID_1 = "00000000-0000-0000-0000-000000000010";
const BUILDING_ID_2 = "00000000-0000-0000-0000-000000000011";
const BLUEPRINT_ID = "00000000-0000-0000-0000-000000000020";
const TIER_ID = "00000000-0000-0000-0000-000000000030";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000040";
const JOB_ID = "00000000-0000-0000-0000-000000000050";
const NEW_BUILDING_ID = "00000000-0000-0000-0000-000000000060";

type TestBuildingRow = {
  readonly activated_on_turn_number: number;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly effects_json: ReadonlyArray<{
      readonly type: string;
      readonly amount: number;
      readonly job_id?: string;
      readonly resource_id?: string;
    }>;
    readonly tier_number: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly created_at: string;
  readonly current_tier_id: string;
  readonly deactivated_in_transition_id: null;
  readonly id: string;
  readonly missed_upkeep_count: number;
  readonly name: string | null;
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
    name: null,
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

type TestResourceRow = {
  readonly base_stockpile_cap: number;
  readonly created_at: string;
  readonly id: string;
  readonly is_system_resource: boolean;
  readonly is_trashed: boolean;
  readonly last_cleanup_summary_json: null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestJobRow = {
  readonly base_capacity: number | null;
  readonly created_at: string;
  readonly culling_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly deposit_types: ReadonlyArray<{ readonly id: string }>;
  readonly husbandry_mpt: ReadonlyArray<{ readonly id: string }>;
  readonly id: string;
  readonly inputs_json: readonly unknown[];
  readonly is_trashed: boolean;
  readonly job_type: string;
  readonly linked_deposit_type_id: string | null;
  readonly linked_managed_population_type_id: string | null;
  readonly name: string;
  readonly outputs_json: readonly unknown[];
  readonly slug: string;
  readonly trader_capacity_per_worker: number | null;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestSnapshotLookupRow = {
  readonly turn_transition_id: string;
};

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
  readonly turn_log_entries: ReadonlyArray<{
    readonly citizen_id: null;
    readonly id: string;
    readonly log_category: string;
    readonly nation_id: null;
    readonly payload_jsonb: unknown;
    readonly resource_id: null;
    readonly settlement_id: string;
    readonly world_id: string;
  }>;
  readonly world_id: string;
};

type TestBlueprintRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly grace_period_turns: number;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly max_instances_per_settlement: number | null;
  readonly name: string;
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TestTierRow = {
  readonly building_blueprint_id: string;
  readonly construction_costs_json: readonly unknown[];
  readonly created_at: string;
  readonly effects_json: readonly unknown[];
  readonly id: string;
  readonly tier_number: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: readonly unknown[];
  readonly worker_turns_required: number;
};

function createClient({
  blueprintRows = [],
  buildingRows = [],
  citizenRows = [],
  jobRows = [],
  latestSnapshotRow = null,
  latestTransitionRow = null,
  populationCap = 0,
  resourceRows = [],
  rpcMock,
  tierRows = [],
}: {
  readonly blueprintRows?: readonly TestBlueprintRow[];
  readonly buildingRows?: readonly TestBuildingRow[];
  readonly citizenRows?: readonly TestCitizenRow[];
  readonly jobRows?: readonly TestJobRow[];
  readonly latestSnapshotRow?: TestSnapshotLookupRow | null;
  readonly latestTransitionRow?: TestTransitionRow | null;
  readonly populationCap?: number;
  readonly resourceRows?: readonly TestResourceRow[];
  readonly rpcMock?: ReturnType<typeof vi.fn>;
  readonly tierRows?: readonly TestTierRow[];
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

  function createSimpleQueryBuilder(rows: readonly unknown[]): unknown {
    const builder: Record<string, unknown> = {
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
      select: vi.fn(() => builder),
    };
    return builder;
  }

  const snapshotLookupBuilder: Record<string, unknown> = {
    eq: vi.fn(() => snapshotLookupBuilder),
    not: vi.fn(() => snapshotLookupBuilder),
    order: vi.fn(() => snapshotLookupBuilder),
    limit: vi.fn(() => snapshotLookupBuilder),
    maybeSingle: vi.fn().mockResolvedValue({
      data: latestSnapshotRow,
      error: null,
    }),
  };

  const transitionBuilder: Record<string, unknown> = {
    eq: vi.fn(() => transitionBuilder),
    maybeSingle: vi.fn().mockResolvedValue({
      data: latestTransitionRow,
      error: null,
    }),
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
      if (table === "resources") {
        return createSimpleQueryBuilder(resourceRows);
      }
      if (table === "job_definitions") {
        return createSimpleQueryBuilder(jobRows);
      }
      if (table === "settlement_turn_snapshots") {
        return { select: vi.fn(() => snapshotLookupBuilder) };
      }
      if (table === "turn_transitions") {
        return { select: vi.fn(() => transitionBuilder) };
      }
      if (table === "building_blueprints") {
        return createSimpleQueryBuilder(blueprintRows);
      }
      if (table === "building_blueprint_tiers") {
        return createSimpleQueryBuilder(tierRows);
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

  it("renders amber Suspended badge for suspended buildings", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Granary" },
            missed_upkeep_count: 1,
            state: "suspended",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Granary");
    const badge = screen.getByRole("generic", { name: "State: Suspended" });
    expect(badge).toBeDefined();
    expect(badge.getAttribute("data-variant")).toBe("warning");
    expect(badge.getAttribute("title")).toBe("Missed upkeep 1×");
  });

  it("renders red Auto-deconstructed badge for auto_deconstructed buildings", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Granary" },
            missed_upkeep_count: 3,
            state: "auto_deconstructed",
          }),
        ],
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Granary");
    const badge = screen.getByRole("generic", {
      name: "State: Auto-deconstructed",
    });
    expect(badge).toBeDefined();
    expect(badge.getAttribute("data-variant")).toBe("destructive");
    expect(badge.getAttribute("title")).toBe("Missed upkeep 3×");
  });

  it("shows transition-sourced tooltip when latest outcome has a matching log entry", async () => {
    const TRANSITION_ID = "00000000-0000-0000-0000-000000000099";

    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprints: { name: "Granary" },
            id: BUILDING_ID_1,
            missed_upkeep_count: 2,
            state: "suspended",
          }),
        ],
        latestSnapshotRow: { turn_transition_id: TRANSITION_ID },
        latestTransitionRow: {
          finished_at: "2026-06-01T01:00:00.000Z",
          from_turn_number: 3,
          id: TRANSITION_ID,
          notifications: [],
          settlement_turn_resource_snapshots: [],
          settlement_turn_snapshots: [],
          started_at: "2026-06-01T00:00:00.000Z",
          status: "completed",
          to_turn_number: 4,
          turn_log_entries: [
            {
              citizen_id: null,
              id: "00000000-0000-0000-0000-000000000088",
              log_category: "building.suspended",
              nation_id: null,
              payload_jsonb: {
                blueprintId: BLUEPRINT_ID,
                buildingId: BUILDING_ID_1,
                missedUpkeepCount: 2,
              },
              resource_id: null,
              settlement_id: SETTLEMENT_ID,
              world_id: WORLD_ID,
            },
          ],
          world_id: WORLD_ID,
        },
        populationCap: 5,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Granary");
    const badge = screen.getByRole("generic", { name: "State: Suspended" });
    expect(badge.getAttribute("title")).toBe("Turn 4 · missed upkeep 2×");
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

  it("resolves resource and job names in effects column", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        buildingRows: [
          createBuildingRow({
            building_blueprint_tiers: {
              effects_json: [
                {
                  amount: 2,
                  job_id: JOB_ID,
                  type: "job_capacity_increase",
                },
                {
                  amount: 50,
                  resource_id: RESOURCE_ID,
                  type: "resource_storage_increase",
                },
                {
                  amount: 3,
                  resource_id: RESOURCE_ID,
                  type: "passive_resource_production",
                },
              ],
              tier_number: 1,
            },
          }),
        ],
        jobRows: [
          {
            base_capacity: null,
            created_at: "2026-05-01T00:00:00.000Z",
            culling_mpt: [],
            deposit_types: [],
            husbandry_mpt: [],
            id: JOB_ID,
            inputs_json: [],
            is_trashed: false,
            job_type: "standard",
            linked_deposit_type_id: null,
            linked_managed_population_type_id: null,
            name: "Miner",
            outputs_json: [],
            slug: "miner",
            trader_capacity_per_worker: null,
            updated_at: "2026-05-01T00:00:00.000Z",
            world_id: WORLD_ID,
          },
        ],
        populationCap: 5,
        resourceRows: [
          {
            base_stockpile_cap: 100,
            created_at: "2026-05-01T00:00:00.000Z",
            id: RESOURCE_ID,
            is_system_resource: false,
            is_trashed: false,
            last_cleanup_summary_json: null,
            name: "Iron Ore",
            slug: "iron-ore",
            updated_at: "2026-05-01T00:00:00.000Z",
            world_id: WORLD_ID,
          },
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Barracks");
    expect(
      screen.getByText(
        "job +2 for Miner, storage +50 for Iron Ore, passive +3/turn of Iron Ore",
      ),
    ).toBeDefined();
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

  it("shows Add building button for admins when not archived", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ buildingRows: [] }));

    renderPanel({ canAdmin: true, isArchived: false });

    expect(
      await screen.findByRole("button", { name: "Add building" }),
    ).toBeDefined();
  });

  it("hides Add building button from non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ buildingRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("No buildings");
    expect(screen.queryByRole("button", { name: "Add building" })).toBeNull();
  });

  it("hides Add building button when the world is archived", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ buildingRows: [] }));

    renderPanel({ canAdmin: true, isArchived: true });

    await screen.findByText("No buildings");
    expect(screen.queryByRole("button", { name: "Add building" })).toBeNull();
  });

  it("opens the Add building dialog when admin clicks the button", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({ blueprintRows: [], buildingRows: [] }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await user.click(
      await screen.findByRole("button", { name: "Add building" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Add building" }),
    ).toBeDefined();
  });

  it("calls add_settlement_building_as_admin RPC and shows success toast on submit", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "settlement_population_cap") {
        return Promise.resolve({ data: 0, error: null });
      }
      if (fn === "add_settlement_building_as_admin") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: NEW_BUILDING_ID },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    const blueprintRow: TestBlueprintRow = {
      created_at: "2026-05-01T00:00:00.000Z",
      description: null,
      grace_period_turns: 3,
      id: BLUEPRINT_ID,
      is_trashed: false,
      max_instances_per_settlement: null,
      name: "Barracks",
      slug: "barracks",
      updated_at: "2026-05-01T00:00:00.000Z",
      world_id: WORLD_ID,
    };

    const tierRow: TestTierRow = {
      building_blueprint_id: BLUEPRINT_ID,
      construction_costs_json: [],
      created_at: "2026-05-01T00:00:00.000Z",
      effects_json: [],
      id: TIER_ID,
      tier_number: 1,
      updated_at: "2026-05-01T00:00:00.000Z",
      upkeep_costs_json: [],
      worker_turns_required: 10,
    };

    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [blueprintRow],
        buildingRows: [],
        rpcMock,
        tierRows: [tierRow],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await user.click(
      await screen.findByRole("button", { name: "Add building" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Add building" });

    // Select a blueprint
    const blueprintSelect = within(dialog).getByRole("combobox", {
      name: "Blueprint",
    });
    await user.selectOptions(blueprintSelect, BLUEPRINT_ID);

    // Select a tier (appears after blueprint is selected)
    const tierSelect = await within(dialog).findByRole("combobox", {
      name: "Tier",
    });
    await user.selectOptions(tierSelect, TIER_ID);

    // Submit
    await user.click(
      within(dialog).getByRole("button", { name: "Add building" }),
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "add_settlement_building_as_admin",
        expect.objectContaining({
          p_blueprint_id: BLUEPRINT_ID,
          p_settlement_id: SETTLEMENT_ID,
          p_tier_id: TIER_ID,
        }),
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Building added.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
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
        worldId={WORLD_ID}
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
