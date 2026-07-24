import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { citizensQueryKeys } from "../../queries/citizensQueryKeys";

import { SettlementAssignmentBoard } from "./index";

import type { SettlementJobCount } from "../../types/bulkAssignmentTypes";
import type { ReactNode } from "react";

const { mockNavigate, requireSupabaseClient } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    Link: function MockLink({
      children,
      "aria-current": ariaCurrent,
      className,
      to,
    }: {
      readonly "aria-current"?: "page";
      readonly children?: ReactNode;
      readonly className?: string;
      readonly to?: string;
    }) {
      return (
        <a aria-current={ariaCurrent} className={className} href={to ?? "#"}>
          {children}
        </a>
      );
    },
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Bulk-tab fixture types
// ---------------------------------------------------------------------------

type AggregateRowFixture = {
  readonly assignment_type:
    | "construction_project"
    | "culling"
    | "deposit"
    | "husbandry"
    | "standard_job"
    | "trade_route"
    | null;
  readonly is_labor_excluded_officeholder?: boolean;
  readonly is_enrolled_in_education?: boolean;
  readonly is_soldier?: boolean;
  readonly citizen_type: "npc" | "player_character";
  readonly id: string;
  readonly status: "alive" | "dead";
};

type JobCountRowFixture = {
  readonly capacity: number;
  readonly current_count: number;
  readonly job_id: string;
  readonly job_name: string;
  readonly job_slug: string;
  readonly qualified_citizen_count: number;
  readonly required_education_level_id: string | null;
  readonly required_education_level_name: string | null;
  readonly world_id: string;
};

type MutationResultFixture = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
};

// ---------------------------------------------------------------------------
// Per-target fixture types
// ---------------------------------------------------------------------------

type CitizenAssignmentRowFixture = {
  readonly assigned_on_turn_number: number;
  readonly assignment_type: "culling" | "deposit" | "husbandry" | "trade_route";
  readonly citizen_id: string;
  readonly citizens: { readonly settlement_id: string };
  readonly construction_project: null;
  readonly created_at: string;
  readonly deposit_instance: {
    readonly id: string;
    readonly name: string;
    readonly deposit_types: {
      readonly name: string;
    };
  } | null;
  readonly job: null;
  readonly managed_population_instance: {
    readonly id: string;
    readonly name: string;
    readonly managed_population_types: {
      readonly name: string;
    };
  } | null;
  readonly trade_route: {
    readonly id: string;
    readonly resources: { readonly name: string };
    readonly origin: { readonly name: string };
    readonly destination: { readonly name: string };
  } | null;
  readonly trade_route_end: string | null;
  readonly updated_at: string;
};

type DepositInstanceRowFixture = {
  readonly created_at: string;
  readonly deposit_instance_resources: readonly [];
  readonly deposit_type_id: string;
  readonly deposit_types: {
    readonly name: string;
  };
  readonly discovered_by_event_id: null;
  readonly id: string;
  readonly max_workers: number | null;
  readonly name: string;
  readonly settlement_id: string;
  readonly status: "active" | "depleted" | "removed";
  readonly updated_at: string;
};

type PopulationInstanceRowFixture = {
  readonly configured_cull_quantity: number;
  readonly created_at: string;
  readonly current_count: number;
  readonly id: string;
  readonly managed_population_type_id: string;
  readonly managed_population_types: {
    readonly name: string;
  };
  readonly name: string;
  readonly settlement_id: string;
  readonly status: "active" | "extinct";
  readonly updated_at: string;
};

type PopulationTypeRowFixture = {
  readonly created_at: string;
  readonly culling_outputs_json: readonly unknown[];
  readonly growth_rate: number;
  readonly icon: string | null;
  readonly icon_color: number | null;
  readonly id: string;
  readonly is_trashed: boolean;
  readonly maintenance_rules_json: readonly unknown[];
  readonly managed_population_culling_jobs: ReadonlyArray<{
    readonly id: string;
    readonly job_id: string;
    readonly max_cull_per_worker: number;
  }>;
  readonly managed_population_husbandry_jobs: ReadonlyArray<{
    readonly id: string;
    readonly job_id: string;
    readonly workers_per_n_animals: number;
  }>;
  readonly name: string;
  readonly referencing_jobs: ReadonlyArray<{ readonly id: string }>;
  readonly regular_outputs_json: readonly unknown[];
  readonly slug: string;
  readonly updated_at: string;
  readonly world_id: string;
};

type TradeRouteRowFixture = {
  readonly created_at: string;
  readonly destination_approval_status: "approved" | "pending" | "rejected";
  readonly destination_approved_by_citizen_id: null;
  readonly destination_settlement: {
    readonly name: string;
    readonly nation: { readonly name: string };
  };
  readonly destination_settlement_id: string;
  readonly id: string;
  readonly origin_approval_status: "approved" | "pending" | "rejected";
  readonly origin_approved_by_citizen_id: null;
  readonly origin_settlement: {
    readonly name: string;
    readonly nation: { readonly name: string };
  };
  readonly origin_settlement_id: string;
  readonly pause_reason_last_transition: null;
  readonly proposed_by_citizen_id: string;
  readonly trade_route_legs: readonly {
    readonly id: string;
    readonly direction: string;
    readonly resource_id: string;
    readonly quantity_per_transition: number;
    readonly resource: { readonly name: string };
  }[];
  readonly replacement_for_trade_route_id: null;
  readonly status: "active" | "cancelled" | "paused" | "proposed" | "replaced";
  readonly updated_at: string;
};

type PerTargetMutationResultFixture = {
  readonly after: number;
  readonly added_citizen_ids: readonly string[];
  readonly before: number;
  readonly removed_citizen_ids: readonly string[];
};

// ---------------------------------------------------------------------------
// Bulk-tab factory functions
// ---------------------------------------------------------------------------

function createAggregateRow(
  overrides: Partial<AggregateRowFixture> = {},
): AggregateRowFixture {
  return {
    assignment_type: null,
    citizen_type: "npc",
    id: "c-1",
    status: "alive",
    ...overrides,
  };
}

function createJobCountRow(
  overrides: Partial<JobCountRowFixture> = {},
): JobCountRowFixture {
  return {
    capacity: 10,
    current_count: 3,
    job_id: "job-1",
    job_name: "Farmer",
    job_slug: "farmer",
    qualified_citizen_count: 10,
    required_education_level_id: null,
    required_education_level_name: null,
    world_id: "world-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Per-target factory functions
// ---------------------------------------------------------------------------

function createCitizenAssignmentRow(
  overrides: Partial<CitizenAssignmentRowFixture> = {},
): CitizenAssignmentRowFixture {
  return {
    assigned_on_turn_number: 1,
    assignment_type: "deposit",
    citizen_id: "citizen-1",
    citizens: { settlement_id: "settlement-1" },
    construction_project: null,
    created_at: "2026-01-01T00:00:00Z",
    deposit_instance: {
      id: "dep-1",
      name: "Iron Vein",
      deposit_types: { name: "Iron" },
    },
    job: null,
    managed_population_instance: null,
    trade_route: null,
    trade_route_end: null,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createDepositInstanceRow(
  overrides: Partial<DepositInstanceRowFixture> = {},
): DepositInstanceRowFixture {
  return {
    created_at: "2026-01-01T00:00:00Z",
    deposit_instance_resources: [],
    deposit_type_id: "dt-1",
    deposit_types: { name: "Iron" },
    discovered_by_event_id: null,
    id: "dep-1",
    max_workers: null,
    name: "Iron Vein",
    settlement_id: "settlement-1",
    status: "active",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createPopulationInstanceRow(
  overrides: Partial<PopulationInstanceRowFixture> = {},
): PopulationInstanceRowFixture {
  return {
    configured_cull_quantity: 2,
    created_at: "2026-01-01T00:00:00Z",
    current_count: 10,
    id: "pop-1",
    managed_population_type_id: "mpt-1",
    managed_population_types: {
      name: "Sheep",
    },
    name: "Flock A",
    settlement_id: "settlement-1",
    status: "active",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createPopulationTypeRow(
  overrides: Partial<PopulationTypeRowFixture> = {},
): PopulationTypeRowFixture {
  return {
    created_at: "2026-01-01T00:00:00Z",
    culling_outputs_json: [],
    growth_rate: 0.05,
    icon: null,
    icon_color: null,
    id: "mpt-1",
    is_trashed: false,
    maintenance_rules_json: [],
    managed_population_culling_jobs: [],
    managed_population_husbandry_jobs: [],
    name: "Sheep",
    referencing_jobs: [],
    regular_outputs_json: [],
    slug: "sheep",
    updated_at: "2026-01-01T00:00:00Z",
    world_id: "world-1",
    ...overrides,
  };
}

function createTradeRouteRow(
  overrides: Partial<TradeRouteRowFixture> = {},
): TradeRouteRowFixture {
  return {
    created_at: "2026-01-01T00:00:00Z",
    destination_approval_status: "approved",
    destination_approved_by_citizen_id: null,
    destination_settlement: {
      name: "Riverside",
      nation: { name: "Empire" },
    },
    destination_settlement_id: "settlement-2",
    id: "route-1",
    origin_approval_status: "approved",
    origin_approved_by_citizen_id: null,
    origin_settlement: {
      name: "Hillfort",
      nation: { name: "Republic" },
    },
    origin_settlement_id: "settlement-1",
    pause_reason_last_transition: null,
    proposed_by_citizen_id: "citizen-1",
    trade_route_legs: [
      {
        id: "leg-1",
        direction: "send",
        resource_id: "res-1",
        quantity_per_transition: 10,
        resource: { name: "Grain" },
      },
    ],
    replacement_for_trade_route_id: null,
    status: "active",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock client builders
// ---------------------------------------------------------------------------

function createTableBuilder(rows: readonly unknown[]): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    select: vi.fn(() => builder),
  };
}

function createRpcBuilder(rows: readonly unknown[]): unknown {
  return {
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
}

function createMaybeSingleBuilder(result: unknown): unknown {
  return {
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
  };
}

// citizen_directory_view backs both the aggregate stats query (plain
// column select + .returns()) and the officeholder count query
// ({ count: "exact", head: true } + .not()) -- dispatch on the select
// options to route each call to the right chain.
function createCitizenDirectoryViewBuilder(
  aggregateRows: readonly AggregateRowFixture[],
  officeholderCount: number,
): unknown {
  const aggregateBuilder = {
    eq: vi.fn(() => aggregateBuilder),
    in: vi.fn(() => aggregateBuilder),
    or: vi.fn(() => aggregateBuilder),
    order: vi.fn(() => aggregateBuilder),
    returns: vi.fn().mockResolvedValue({ data: aggregateRows, error: null }),
  };
  const officeholderBuilder = {
    eq: vi.fn(() => officeholderBuilder),
    not: vi.fn(() =>
      Promise.resolve({ count: officeholderCount, error: null }),
    ),
  };
  return {
    select: vi.fn((_columns?: string, opts?: { readonly head?: boolean }) =>
      opts?.head === true ? officeholderBuilder : aggregateBuilder,
    ),
  };
}

// ---------------------------------------------------------------------------
// createClient
// ---------------------------------------------------------------------------

function createClient(config: {
  // Bulk-tab config
  readonly aggregates?: readonly AggregateRowFixture[];
  readonly jobCounts?: readonly JobCountRowFixture[];
  readonly jobMutationResult?: MutationResultFixture;
  readonly constructionPoolMutationResult?: MutationResultFixture;
  // Per-target config
  readonly citizenAssignmentRows?: readonly CitizenAssignmentRowFixture[];
  readonly depositInstanceRows?: readonly DepositInstanceRowFixture[];
  readonly populationInstanceRows?: readonly PopulationInstanceRowFixture[];
  readonly populationTypeRows?: readonly PopulationTypeRowFixture[];
  readonly tradeRouteRows?: readonly TradeRouteRowFixture[];
  readonly perTargetMutationResult?: PerTargetMutationResultFixture;
  readonly officeholderCount?: number;
}): unknown {
  const defaultMutationResult: MutationResultFixture = {
    after: 1,
    added_citizen_ids: [],
    before: 0,
    removed_citizen_ids: [],
  };

  const defaultPerTargetResult: PerTargetMutationResultFixture = {
    after: 1,
    added_citizen_ids: [],
    before: 0,
    removed_citizen_ids: [],
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "citizen_assignments") {
        return createTableBuilder(config.citizenAssignmentRows ?? []);
      }
      if (table === "deposit_instances") {
        return createTableBuilder(config.depositInstanceRows ?? []);
      }
      if (table === "managed_population_instances") {
        return createTableBuilder(config.populationInstanceRows ?? []);
      }
      if (table === "managed_population_types") {
        return createTableBuilder(config.populationTypeRows ?? []);
      }
      if (table === "trade_routes") {
        return createTableBuilder(config.tradeRouteRows ?? []);
      }
      if (table === "citizen_directory_view") {
        return createCitizenDirectoryViewBuilder(
          config.aggregates ?? [],
          config.officeholderCount ?? 0,
        );
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((name: string) => {
      if (name === "get_settlement_standard_job_counts") {
        return createRpcBuilder(config.jobCounts ?? []);
      }
      if (name === "set_bulk_standard_job_assignment") {
        return createMaybeSingleBuilder(
          config.jobMutationResult ?? defaultMutationResult,
        );
      }
      if (name === "set_per_target_bulk_assignment") {
        return createMaybeSingleBuilder(
          config.perTargetMutationResult ?? defaultPerTargetResult,
        );
      }
      if (name === "set_bulk_construction_pool") {
        return createMaybeSingleBuilder(
          config.constructionPoolMutationResult ?? defaultMutationResult,
        );
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }),
  };
}

// ---------------------------------------------------------------------------
// renderBoard
// ---------------------------------------------------------------------------

function renderBoard(
  props: Partial<{
    canManageSettlement: boolean;
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
      <SettlementAssignmentBoard
        canManageSettlement={props.canManageSettlement ?? true}
        isArchived={props.isArchived ?? false}
        nationId={props.nationId ?? "nation-1"}
        settlementId={props.settlementId ?? "settlement-1"}
        worldId={props.worldId ?? "world-1"}
      />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettlementAssignmentBoard", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    requireSupabaseClient.mockReset();
  });

  it("unified table renders bulk + per-target rows in one tbody", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [
          createJobCountRow({
            job_name: "Farmer",
            current_count: 3,
            capacity: 10,
          }),
        ],
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({
            id: "dep-1",
            name: "Iron Vein",
            status: "active",
          }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard();

    // Unified table renders both bulk and per-target rows in one table
    expect(await screen.findByText("Farmer")).toBeDefined();
    expect(await screen.findByText("Iron Vein — Iron")).toBeDefined();
    // Only one table tbody (not separate tabs)
    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(1);
    const rows = tables[0].querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(1); // Farmer + Iron Vein deposit
  });

  it("shows standard job rows with current/capacity display", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [
          createJobCountRow({
            capacity: 10,
            current_count: 3,
            job_id: "job-1",
            job_name: "Farmer",
          }),
          createJobCountRow({
            capacity: 5,
            current_count: 1,
            job_id: "job-2",
            job_name: "Miner",
          }),
        ],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Farmer")).toBeDefined();
    expect(screen.getByText("3 / 10")).toBeDefined();
    expect(screen.getByText("Miner")).toBeDefined();
    expect(screen.getByText("1 / 5")).toBeDefined();
  });

  it("shows construction job as a regular row in the merged table", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [
          createJobCountRow({
            job_id: "11111111-1111-1111-1111-111111111111",
            job_name: "Farmer",
            current_count: 3,
            capacity: 10,
          }),
          createJobCountRow({
            job_id: "22222222-2222-2222-2222-222222222222",
            job_name: "Stone Mason",
            job_slug: "stone-mason",
            current_count: 2,
            capacity: 4,
          }),
        ],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Farmer")).toBeDefined();
    expect(await screen.findByText("Stone Mason")).toBeDefined();
    expect(screen.getByText("2 / 4")).toBeDefined();
  });

  it("shows inline editor with Apply button when canManageSettlement and not archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManageSettlement: true, isArchived: false });

    await screen.findByText("Farmer");
    const farmerRow = screen.getByText("Farmer").closest("tr");
    expect(
      within(farmerRow as HTMLElement).getByRole("button", { name: "Apply" }),
    ).toBeDefined();
  });

  it("hides the editor when isArchived is true", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManageSettlement: true, isArchived: true });

    await screen.findByText("Farmer");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("hides the editor when canManageSettlement is false", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManageSettlement: false, isArchived: false });

    await screen.findByText("Farmer");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("shows a live unassigned summary above the table, not as a table row", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
          createAggregateRow({
            id: "c-2",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
          createAggregateRow({
            id: "c-3",
            citizen_type: "npc",
            status: "alive",
            assignment_type: "standard_job",
          }),
        ],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard();

    await screen.findByText("Farmer");
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("unassigned")).toBeDefined();
    // rows[0] is the header; rows[1] is the first data row (no separate Unassigned
    // row). "Construction" sorts alphabetically before "Farmer".
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Construction");
    expect(rows[2]).toHaveTextContent("Farmer");
  });

  it("shows an officeholder banner when the settlement has citizens holding a nation office", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
        ],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
        officeholderCount: 2,
      }),
    );

    renderBoard();

    expect(
      await screen.findByText(/2 citizens in this settlement/),
    ).toBeDefined();
  });

  it("hides the officeholder banner when no citizens in the settlement hold office", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
        ],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
        officeholderCount: 0,
      }),
    );

    renderBoard();

    await screen.findByText("Farmer");
    expect(screen.queryByText(/hold.*nation office/)).toBeNull();
  });

  it("standard job rows sort alphabetically without a pinned Unassigned row", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [
          createJobCountRow({ job_id: "job-1", job_name: "Archer" }),
          createJobCountRow({ job_id: "job-2", job_name: "Baker" }),
        ],
      }),
    );

    renderBoard();

    await screen.findByText("Archer");
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Archer");
    expect(rows[2]).toHaveTextContent("Baker");
  });

  it("unassigned summary has no Set count editor", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManageSettlement: true });

    await screen.findByText("Farmer");
    const summary = screen.getByText("unassigned").closest("div");
    expect(summary?.querySelector("input")).toBeNull();
    expect(summary?.querySelector("button")).toBeNull();
  });

  it("unassigned summary shows only NPC count, excluding player characters", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
          createAggregateRow({
            id: "c-2",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
          createAggregateRow({
            id: "c-3",
            citizen_type: "player_character",
            status: "alive",
            assignment_type: null,
          }),
        ],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard();

    await screen.findByText("Farmer");
    // 2 NPCs unassigned; the PC is not counted
    expect(screen.getByText("2")).toBeDefined();
  });

  it("construction workers are not counted as unassigned", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
          createAggregateRow({
            id: "c-2",
            citizen_type: "npc",
            status: "alive",
            assignment_type: "construction_project",
          }),
        ],
        jobCounts: [
          createJobCountRow({ job_name: "Farmer" }),
          createJobCountRow({
            job_id: "22222222-2222-2222-2222-222222222222",
            job_name: "Stone Mason",
            current_count: 1,
            capacity: 4,
          }),
        ],
      }),
    );

    renderBoard();

    await screen.findByText("Stone Mason");
    // Only 1 truly unassigned NPC; the construction worker is assigned
    expect(screen.getByText("1")).toBeDefined();
  });

  it("disables Apply button when raising count and no citizens are unassigned", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [
          createJobCountRow({
            job_name: "Farmer",
            current_count: 3,
            capacity: 10,
          }),
        ],
      }),
    );

    renderBoard({ canManageSettlement: true });

    await screen.findByText("Farmer");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    await user.clear(input);
    await user.type(input, "5");

    const farmerRow = input.closest("tr") as HTMLElement;
    const applyButton = within(farmerRow).getByRole("button", {
      name: "Apply",
    });
    expect(applyButton).toBeDisabled();
  });

  it("enables Apply button when raising count and citizens are available", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
        ],
        jobCounts: [
          createJobCountRow({
            job_name: "Farmer",
            current_count: 3,
            capacity: 10,
          }),
        ],
      }),
    );

    renderBoard({ canManageSettlement: true });

    await screen.findByText("Farmer");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    await user.clear(input);
    await user.type(input, "5");

    const farmerRow = input.closest("tr") as HTMLElement;
    const applyButton = within(farmerRow).getByRole("button", {
      name: "Apply",
    });
    expect(applyButton).not.toBeDisabled();
  });

  it("enables Apply button when lowering count even with no unassigned citizens", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [
          createJobCountRow({
            job_name: "Farmer",
            current_count: 3,
            capacity: 10,
          }),
        ],
      }),
    );

    renderBoard({ canManageSettlement: true });

    await screen.findByText("Farmer");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    await user.clear(input);
    await user.type(input, "1");

    const farmerRow = input.closest("tr") as HTMLElement;
    const applyButton = within(farmerRow).getByRole("button", {
      name: "Apply",
    });
    expect(applyButton).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Construction pool row tests
  // -------------------------------------------------------------------------

  it("shows a Construction pool row with unlimited capacity", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            assignment_type: "construction_project",
          }),
        ],
        jobCounts: [],
      }),
    );

    renderBoard();

    const constructionRow = (await screen.findByText("Construction")).closest(
      "tr",
    ) as HTMLElement;
    expect(
      within(constructionRow).getByText(
        (_, el) => el?.textContent === "1 / unlimited",
      ),
    ).toBeDefined();
  });

  it("clicking Apply on the Construction row calls the bulk construction pool RPC and shows success toast", async () => {
    const CITIZEN_UUID = "11111111-1111-1111-1111-111111111111";
    const SETTLEMENT_UUID = "22222222-2222-2222-2222-222222222222";

    const user = userEvent.setup();
    vi.mocked(toast.success).mockClear();
    const client = createClient({
      aggregates: [
        createAggregateRow({
          id: CITIZEN_UUID,
          citizen_type: "npc",
          status: "alive",
          assignment_type: null,
        }),
      ],
      jobCounts: [],
      constructionPoolMutationResult: {
        after: 1,
        added_citizen_ids: [CITIZEN_UUID],
        before: 0,
        removed_citizen_ids: [],
      },
    }) as { readonly rpc: ReturnType<typeof vi.fn> };
    requireSupabaseClient.mockReturnValue(client);

    renderBoard({
      canManageSettlement: true,
      settlementId: SETTLEMENT_UUID,
    });

    const input = await screen.findByRole("spinbutton", {
      name: "Target count for Construction",
    });
    await user.clear(input);
    await user.type(input, "1");
    const constructionRow = input.closest("tr") as HTMLElement;
    await user.click(
      within(constructionRow).getByRole("button", { name: "Apply" }),
    );

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
    });

    expect(client.rpc).toHaveBeenCalledWith("set_bulk_construction_pool", {
      p_settlement_id: SETTLEMENT_UUID,
      p_target_count: 1,
    });
  });

  // -------------------------------------------------------------------------
  // Per-target tab tests
  // -------------------------------------------------------------------------

  it("shows deposit section with deposit name and capacity hint on per-target tab", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({
            id: "dep-1",
            name: "Iron Vein",
            max_workers: 4,
            status: "active",
          }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Iron Vein — Iron")).toBeDefined();
    expect(screen.getByText("0 / 4")).toBeDefined();
  });

  it("shows deposit capacity as assigned count only when max_workers is null", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({
            id: "dep-1",
            name: "Coal Seam",
            max_workers: null,
          }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Coal Seam — Iron")).toBeDefined();
    // Multiple "no upper bound" labels exist (unassigned + deposit rows), so check the deposit row specifically
    const depositRow = screen.getByText("Coal Seam — Iron").closest("tr");
    expect(
      depositRow?.querySelector("[aria-label='no upper bound']"),
    ).toBeInTheDocument();
  });

  it("shows husbandry and culling sections with population name and type name", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [],
        populationInstanceRows: [
          createPopulationInstanceRow({
            id: "pop-1",
            name: "Flock A",
            managed_population_types: { name: "Sheep" },
          }),
        ],
        tradeRouteRows: [],
      }),
    );

    renderBoard();

    // A population type can link 1..n husbandry jobs and 1..n culling jobs
    // (#1247), so both the husbandry row and the culling row show the
    // population type's own name — there's no single job name to show.
    expect(await screen.findAllByText("Flock A — Sheep")).toHaveLength(2);
  });

  it("shows the needed-workers maximum for husbandry and culling rows", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [],
        populationInstanceRows: [
          createPopulationInstanceRow({
            id: "pop-1",
            name: "Flock A",
            managed_population_type_id: "mpt-1",
            managed_population_types: { name: "Sheep" },
            current_count: 25,
            configured_cull_quantity: 12,
          }),
        ],
        populationTypeRows: [
          createPopulationTypeRow({
            id: "mpt-1",
            name: "Sheep",
            managed_population_husbandry_jobs: [
              { id: "hj-1", job_id: "job-h1", workers_per_n_animals: 5 },
            ],
            managed_population_culling_jobs: [
              { id: "cj-1", job_id: "job-c1", max_cull_per_worker: 4 },
            ],
          }),
        ],
        tradeRouteRows: [],
      }),
    );

    renderBoard();

    await screen.findAllByText("Flock A — Sheep");

    // Husbandry: ceil(25 / 5) = 5 needed.
    expect(
      screen
        .getAllByText((_, el) => el?.textContent === "0 / 5 needed")
        .find((el) => el.tagName === "SPAN"),
    ).toBeInTheDocument();
    // Culling: ceil(12 / 4) = 3 needed.
    expect(
      screen
        .getAllByText((_, el) => el?.textContent === "0 / 3 needed")
        .find((el) => el.tagName === "SPAN"),
    ).toBeInTheDocument();
  });

  it("shows trade route section with origin and destination labels", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [],
        populationInstanceRows: [],
        tradeRouteRows: [
          createTradeRouteRow({
            id: "route-1",
            origin_settlement_id: "settlement-1",
            destination_settlement_id: "settlement-2",
            origin_settlement: {
              name: "Hillfort",
              nation: { name: "Republic" },
            },
            destination_settlement: {
              name: "Riverside",
              nation: { name: "Empire" },
            },
            status: "active",
          }),
        ],
      }),
    );

    renderBoard();

    // Trade route rows appear in the unified table; both local and remote ends shown
    expect(await screen.findByText("Trader: Grain → Riverside")).toBeDefined();
    expect(
      screen.getByText(/Trader \(receiving — remote\): Riverside/),
    ).toBeDefined();
  });

  it("shows assigned count on deposit row", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [
          createCitizenAssignmentRow({
            citizen_id: "citizen-1",
            assignment_type: "deposit",
            deposit_instance: {
              id: "dep-1",
              name: "Iron Vein",
              deposit_types: { name: "Iron" },
            },
          }),
        ],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Iron Vein — Iron")).toBeDefined();
    expect(
      screen.getByText((_, el) => el?.textContent === "1 / unlimited"),
    ).toBeDefined();
  });

  it("shows Apply button when canManageSettlement and not archived on per-target tab", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({
      canManageSettlement: true,
      isArchived: false,
    });

    await screen.findByText("Iron Vein — Iron");
    const depositRow = screen.getByText("Iron Vein — Iron").closest("tr");
    expect(
      within(depositRow as HTMLElement).getByRole("button", {
        name: "Apply",
      }),
    ).toBeDefined();
  });

  it("hides Apply button when canManageSettlement is false", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({
      canManageSettlement: false,
      isArchived: false,
    });

    await screen.findByText("Iron Vein — Iron");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("hides Apply button when isArchived is true", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({
      canManageSettlement: true,
      isArchived: true,
    });

    await screen.findByText("Iron Vein — Iron");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("filters out non-active deposits and populations from per-target sections", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({
            id: "dep-active",
            name: "Active Vein",
            status: "active",
          }),
          createDepositInstanceRow({
            id: "dep-depleted",
            name: "Depleted Vein",
            status: "depleted",
          }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Active Vein — Iron")).toBeDefined();
    expect(screen.queryByText("Depleted Vein")).toBeNull();
  });

  it("clicking Apply on deposit row calls per-target bulk assignment and shows success toast", async () => {
    const SETTLEMENT_UUID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const DEPOSIT_UUID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const NPC_UUID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    const user = userEvent.setup();
    vi.mocked(toast.success).mockClear();
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: NPC_UUID,
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
        ],
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({
            id: DEPOSIT_UUID,
            name: "Iron Vein",
            settlement_id: SETTLEMENT_UUID,
          }),
        ],
        perTargetMutationResult: {
          after: 1,
          added_citizen_ids: [NPC_UUID],
          before: 0,
          removed_citizen_ids: [],
        },
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({
      canManageSettlement: true,
      settlementId: SETTLEMENT_UUID,
    });

    await screen.findByText("Iron Vein — Iron");
    const input = screen.getByRole("spinbutton", {
      name: "Target count for Iron Vein — Iron",
    });
    await user.clear(input);
    await user.type(input, "1");
    const depositRow = input.closest("tr") as HTMLElement;
    await user.click(within(depositRow).getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
    });
  });

  it("after construction job Apply, invalidates settlementJobCounts, settlementList, and settlementAggregateStats", async () => {
    const CITIZEN_UUID = "11111111-1111-1111-1111-111111111111";
    const SETTLEMENT_UUID = "22222222-2222-2222-2222-222222222222";

    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(toast.success).mockClear();

    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: CITIZEN_UUID,
            citizen_type: "npc",
            status: "alive",
            assignment_type: null,
          }),
        ],
        jobCounts: [
          createJobCountRow({
            job_id: "33333333-3333-3333-3333-333333333333",
            job_name: "Stone Mason",
            job_slug: "stone-mason",
            current_count: 0,
            capacity: 4,
          }),
        ],
      }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <SettlementAssignmentBoard
          canManageSettlement={true}
          isArchived={false}
          nationId="nation-1"
          settlementId={SETTLEMENT_UUID}
          worldId="world-1"
        />
      </QueryClientProvider>,
    );

    await screen.findByText("Stone Mason");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Stone Mason",
    });
    await user.clear(input);
    await user.type(input, "1");
    const stoneMasonRow = input.closest("tr") as HTMLElement;
    await user.click(
      within(stoneMasonRow).getByRole("button", { name: "Apply" }),
    );

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalled();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: citizensQueryKeys.settlementJobCounts(SETTLEMENT_UUID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: citizensQueryKeys.settlementList(SETTLEMENT_UUID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: citizensQueryKeys.settlementAggregateStats(SETTLEMENT_UUID),
    });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["forecast", "world", "world-1"],
      }),
    );
  });

  it("resyncs a mounted row's input when the server count changes externally", async () => {
    const SETTLEMENT_UUID = "22222222-2222-2222-2222-222222222222";

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [
          createJobCountRow({
            job_id: "job-1",
            job_name: "Farmer",
            current_count: 3,
            capacity: 10,
          }),
        ],
      }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <SettlementAssignmentBoard
          canManageSettlement={true}
          isArchived={false}
          nationId="nation-1"
          settlementId={SETTLEMENT_UUID}
          worldId="world-1"
        />
      </QueryClientProvider>,
    );

    const input = await screen.findByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    expect(input).toHaveValue(3);

    // Simulate an external change to the server count (e.g. another user's
    // change or a turn advance) landing in the cache while the row stays
    // mounted.
    const updated: readonly SettlementJobCount[] = [
      {
        capacity: 10,
        currentCount: 8,
        jobId: "job-1",
        jobName: "Farmer",
        jobSlug: "farmer",
        qualifiedCitizenCount: 10,
        requiredEducationLevelId: null,
        requiredEducationLevelName: null,
        worldId: "world-1",
      },
    ];
    queryClient.setQueryData(
      citizensQueryKeys.settlementJobCounts(SETTLEMENT_UUID),
      updated,
    );

    await waitFor(() => {
      expect(input).toHaveValue(8);
    });
  });

  it("Apply button is disabled with tooltip when no unassigned NPCs and count is raised", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({ canManageSettlement: true });

    await screen.findByText("Iron Vein — Iron");
    const input = screen.getByRole("spinbutton", {
      name: "Target count for Iron Vein — Iron",
    });
    await user.clear(input);
    await user.type(input, "1");

    const depositRow = input.closest("tr") as HTMLElement;
    const applyButton = within(depositRow).getByRole("button", {
      name: "Apply",
    });
    expect(applyButton).toBeDisabled();
    expect(applyButton.closest("span[title]")).toHaveAttribute(
      "title",
      "No unassigned NPCs available",
    );
  });
});
