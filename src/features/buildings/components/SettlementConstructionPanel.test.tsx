import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementConstructionPanel } from "./SettlementConstructionPanel";

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
const PROJECT_ID_1 = "00000000-0000-0000-0000-000000000010";
const PROJECT_ID_2 = "00000000-0000-0000-0000-000000000011";
const BLUEPRINT_ID = "00000000-0000-0000-0000-000000000020";
const TIER_ID = "00000000-0000-0000-0000-000000000030";
const BUILDING_ID_1 = "00000000-0000-0000-0000-000000000040";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000050";

type TestProjectRow = {
  readonly activated_on_turn_number: number | null;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly tier_number: number;
    readonly worker_turns_required: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly completed_in_transition_id: string | null;
  readonly created_at: string;
  readonly id: string;
  readonly progress_worker_turns: number;
  readonly queue_position: number;
  readonly settlement_id: string;
  readonly status: string;
  readonly target_tier_id: string;
  readonly updated_at: string;
};

function createProjectRow(
  overrides: Partial<TestProjectRow> = {},
): TestProjectRow {
  return {
    activated_on_turn_number: null,
    building_blueprint_id: BLUEPRINT_ID,
    building_blueprint_tiers: {
      tier_number: 1,
      worker_turns_required: 10,
    },
    building_blueprints: { name: "Barracks" },
    completed_in_transition_id: null,
    created_at: "2026-05-01T00:00:00.000Z",
    id: PROJECT_ID_1,
    progress_worker_turns: 0,
    queue_position: 1,
    settlement_id: SETTLEMENT_ID,
    status: "queued",
    target_tier_id: TIER_ID,
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type TestBuildingRow = {
  readonly activated_on_turn_number: number;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly effects_json: ReadonlyArray<{
      readonly type: string;
      readonly amount: number;
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
      effects_json: [],
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

function createBlueprintRow(
  overrides: Partial<TestBlueprintRow> = {},
): TestBlueprintRow {
  return {
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    grace_period_turns: 0,
    id: BLUEPRINT_ID,
    is_trashed: false,
    max_instances_per_settlement: null,
    name: "Barracks",
    slug: "barracks",
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type TestTierRow = {
  readonly building_blueprint_id: string;
  readonly construction_costs_json: ReadonlyArray<{
    readonly amount: number;
    readonly resource_id: string;
  }>;
  readonly created_at: string;
  readonly effects_json: ReadonlyArray<unknown>;
  readonly id: string;
  readonly tier_number: number;
  readonly updated_at: string;
  readonly upkeep_costs_json: ReadonlyArray<unknown>;
  readonly worker_turns_required: number;
};

function createTierRow(overrides: Partial<TestTierRow> = {}): TestTierRow {
  return {
    building_blueprint_id: BLUEPRINT_ID,
    construction_costs_json: [],
    created_at: "2026-05-01T00:00:00.000Z",
    effects_json: [],
    id: TIER_ID,
    tier_number: 1,
    updated_at: "2026-05-01T00:00:00.000Z",
    upkeep_costs_json: [],
    worker_turns_required: 10,
    ...overrides,
  };
}

type TestResourceRow = {
  readonly id: string;
  readonly name: string;
  readonly [key: string]: unknown;
};

function createClient({
  blueprintRows = [],
  buildingRows = [],
  projectRows = [],
  resourceRows = [],
  tierRows = [],
  rpcMock,
}: {
  readonly blueprintRows?: readonly TestBlueprintRow[];
  readonly buildingRows?: readonly TestBuildingRow[];
  readonly projectRows?: readonly TestProjectRow[];
  readonly resourceRows?: readonly TestResourceRow[];
  readonly tierRows?: readonly TestTierRow[];
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): unknown {
  const projectsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => projectsSelectBuilder),
    order: vi.fn(() => projectsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: projectRows, error: null }),
  };

  const buildingsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => buildingsSelectBuilder),
    order: vi.fn(() => buildingsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: buildingRows, error: null }),
  };

  const blueprintsSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => blueprintsSelectBuilder),
    order: vi.fn(() => blueprintsSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: blueprintRows, error: null }),
  };

  const tiersSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => tiersSelectBuilder),
    order: vi.fn(() => tiersSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: tierRows, error: null }),
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

  const defaultRpcMock = vi.fn(() => {
    throw new Error("Unexpected RPC call");
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "construction_projects") {
        return { select: vi.fn(() => projectsSelectBuilder) };
      }
      if (table === "settlement_buildings") {
        return { select: vi.fn(() => buildingsSelectBuilder) };
      }
      if (table === "building_blueprints") {
        return { select: vi.fn(() => blueprintsSelectBuilder) };
      }
      if (table === "building_blueprint_tiers") {
        return { select: vi.fn(() => tiersSelectBuilder) };
      }
      if (table === "resources") {
        return createSimpleQueryBuilder(resourceRows);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock ?? defaultRpcMock,
  };
}

describe("SettlementConstructionPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows empty state when no active projects", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ projectRows: [] }));

    renderPanel({ canManage: false, isArchived: false });

    expect(await screen.findByText("No active projects")).toBeDefined();
  });

  it("renders active projects in the queue table", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        projectRows: [
          createProjectRow({ status: "queued" }),
          createProjectRow({
            building_blueprints: { name: "Granary" },
            id: PROJECT_ID_2,
            queue_position: 2,
            status: "in_progress",
          }),
        ],
      }),
    );

    renderPanel({ canManage: false, isArchived: false });

    await screen.findByText("Barracks");
    expect(screen.getByText("Granary")).toBeDefined();
    expect(screen.getByText("queued")).toBeDefined();
    expect(screen.getByText("in progress")).toBeDefined();
  });

  it("filters out terminal-status projects from the queue", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        projectRows: [
          createProjectRow({ status: "cancelled" }),
          createProjectRow({
            building_blueprints: { name: "Granary" },
            id: PROJECT_ID_2,
            status: "complete",
          }),
        ],
      }),
    );

    renderPanel({ canManage: false, isArchived: false });

    expect(await screen.findByText("No active projects")).toBeDefined();
  });

  it("shows progress in worker-turns format", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        projectRows: [
          createProjectRow({
            building_blueprint_tiers: {
              tier_number: 1,
              worker_turns_required: 20,
            },
            progress_worker_turns: 5,
          }),
        ],
      }),
    );

    renderPanel({ canManage: false, isArchived: false });

    await screen.findByText("Barracks");
    expect(screen.getByText(/5 \/ 20 worker-turns/)).toBeDefined();
  });

  it("hides Start construction button from non-managers", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ projectRows: [] }));

    renderPanel({ canManage: false, isArchived: false });

    await screen.findByText("No active projects");
    expect(
      screen.queryByRole("button", { name: "Start construction" }),
    ).toBeNull();
  });

  it("shows Start construction button for managers on non-archived worlds", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ projectRows: [] }));

    renderPanel({ canManage: true, isArchived: false });

    await screen.findByText("No active projects");
    expect(
      screen.getByRole("button", { name: "Start construction" }),
    ).toBeDefined();
  });

  it("hides Start construction button when world is archived", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ projectRows: [] }));

    renderPanel({ canManage: true, isArchived: true });

    await screen.findByText("No active projects");
    expect(
      screen.queryByRole("button", { name: "Start construction" }),
    ).toBeNull();
  });

  it("calls create RPC and shows success toast on happy path", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "create_construction_project") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: PROJECT_ID_1, settlement_id: SETTLEMENT_ID },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [createBlueprintRow()],
        projectRows: [],
        tierRows: [createTierRow()],
        rpcMock,
      }),
    );

    renderPanel({ canManage: true, isArchived: false });

    await screen.findByText("No active projects");
    await user.click(
      screen.getByRole("button", { name: "Start construction" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Start construction",
    });

    const blueprintSelect = within(dialog).getByLabelText("Blueprint");
    await user.selectOptions(blueprintSelect, BLUEPRINT_ID);

    const tierSelect = await within(dialog).findByLabelText("Tier");
    await user.selectOptions(tierSelect, TIER_ID);

    await user.click(within(dialog).getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("create_construction_project", {
        p_blueprint_id: BLUEPRINT_ID,
        p_settlement_id: SETTLEMENT_ID,
        p_target_tier_id: TIER_ID,
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Construction project started.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows cap overflow error when blueprint is at max instances", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [
          createBlueprintRow({ max_instances_per_settlement: 1 }),
        ],
        buildingRows: [createBuildingRow({ state: "active" })],
        projectRows: [],
      }),
    );

    renderPanel({ canManage: true, isArchived: false });

    await screen.findByText("No active projects");
    await user.click(
      screen.getByRole("button", { name: "Start construction" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Start construction",
    });

    const blueprintSelect = within(dialog).getByLabelText("Blueprint");
    await user.selectOptions(blueprintSelect, BLUEPRINT_ID);

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "1 of 1 allowed instance",
    );

    expect(
      within(dialog).getByRole("button", { name: "Start" }),
    ).toBeDisabled();
  });

  it("renders resource name instead of UUID in construction cost list", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        blueprintRows: [createBlueprintRow()],
        projectRows: [],
        resourceRows: [{ id: RESOURCE_ID, name: "Lumber" }],
        tierRows: [
          createTierRow({
            construction_costs_json: [{ amount: 12, resource_id: RESOURCE_ID }],
          }),
        ],
      }),
    );

    renderPanel({ canManage: true, isArchived: false });

    await screen.findByText("No active projects");
    await user.click(
      screen.getByRole("button", { name: "Start construction" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Start construction",
    });

    const blueprintSelect = within(dialog).getByLabelText("Blueprint");
    await user.selectOptions(blueprintSelect, BLUEPRINT_ID);

    const tierSelect = await within(dialog).findByLabelText("Tier");
    await user.selectOptions(tierSelect, TIER_ID);

    await screen.findByText("Construction cost");
    expect(screen.getByText(/Lumber/)).toBeDefined();
    expect(screen.queryByText(new RegExp(RESOURCE_ID))).toBeNull();
  });

  it("calls reorder RPC with swapped positions when moving a project down", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "reorder_construction_projects") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: { updated_count: 2 },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        projectRows: [
          createProjectRow({ id: PROJECT_ID_1, queue_position: 1 }),
          createProjectRow({
            building_blueprints: { name: "Granary" },
            id: PROJECT_ID_2,
            queue_position: 2,
          }),
        ],
        rpcMock,
      }),
    );

    renderPanel({ canManage: true, isArchived: false });

    await screen.findByText("Barracks");

    await user.click(
      screen.getByRole("button", { name: "Move Barracks down in queue" }),
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("reorder_construction_projects", {
        p_settlement_id: SETTLEMENT_ID,
        p_positions: [
          { position: 1, projectId: PROJECT_ID_2 },
          { position: 2, projectId: PROJECT_ID_1 },
        ],
      });
    });
  });

  it("calls cancel RPC and shows success with unassigned count", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "cancel_construction_project") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              project_id: PROJECT_ID_1,
              unassigned_citizen_count: 3,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        projectRows: [createProjectRow()],
        rpcMock,
      }),
    );

    renderPanel({ canManage: true, isArchived: false });

    await screen.findByText("Barracks");
    await user.click(screen.getByRole("button", { name: "Cancel Barracks" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Cancel Barracks?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Cancel project" }),
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("cancel_construction_project", {
        p_project_id: PROJECT_ID_1,
      });
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Construction project cancelled.",
        { description: "3 citizen(s) unassigned." },
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});

function renderPanel({
  canManage,
  isArchived,
}: {
  readonly canManage: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementConstructionPanel
        canManage={canManage}
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
