import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { citizensQueryKeys } from "../../queries/citizensQueryKeys";

import { SettlementAssignmentBoard } from "./index";

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
  readonly citizen_assignments: ReadonlyArray<{
    readonly assignment_type:
      | "construction_project"
      | "culling"
      | "deposit"
      | "husbandry"
      | "standard_job"
      | "trade_route";
  }> | null;
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

type CitizenRowFixture = {
  readonly born_on_turn_number: number | null;
  readonly citizen_type: "npc" | "player_character";
  readonly created_at: string;
  readonly death_cause: null;
  readonly id: string;
  readonly name: string;
  readonly npc_flaw: null;
  readonly npc_goal: null;
  readonly npc_secret_contradiction: null;
  readonly npc_trait_1: null;
  readonly npc_trait_2: null;
  readonly parent_a_citizen_id: null;
  readonly parent_b_citizen_id: null;
  readonly personality_text: null;
  readonly profile_photo_url: null;
  readonly role_nation_id: null;
  readonly role_settlement_id: null;
  readonly role_type: "none";
  readonly settlement_id: string;
  readonly sex: null;
  readonly skills_text: null;
  readonly status: "alive" | "dead";
  readonly updated_at: string;
  readonly user_id: null;
  readonly world_id: string;
};

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
      readonly job: { readonly name: string };
    };
  } | null;
  readonly job: null;
  readonly managed_population_instance: {
    readonly id: string;
    readonly name: string;
    readonly managed_population_types: {
      readonly husbandry_job: { readonly name: string };
      readonly culling_job: { readonly name: string };
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
    readonly job: { readonly name: string };
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
    readonly culling_job: { readonly name: string };
    readonly husbandry_job: { readonly name: string };
    readonly name: string;
  };
  readonly name: string;
  readonly settlement_id: string;
  readonly status: "active" | "extinct";
  readonly updated_at: string;
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
  readonly assigned_count: number;
  readonly replaced_count: number;
};

// ---------------------------------------------------------------------------
// Bulk-tab factory functions
// ---------------------------------------------------------------------------

function createAggregateRow(
  overrides: Partial<AggregateRowFixture> = {},
): AggregateRowFixture {
  return {
    citizen_assignments: null,
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
    world_id: "world-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Per-target factory functions
// ---------------------------------------------------------------------------

function createCitizenRow(
  overrides: Partial<CitizenRowFixture> = {},
): CitizenRowFixture {
  return {
    born_on_turn_number: null,
    citizen_type: "npc",
    created_at: "2026-01-01T00:00:00Z",
    death_cause: null,
    id: "citizen-1",
    name: "Alice",
    npc_flaw: null,
    npc_goal: null,
    npc_secret_contradiction: null,
    npc_trait_1: null,
    npc_trait_2: null,
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
    personality_text: null,
    profile_photo_url: null,
    role_nation_id: null,
    role_settlement_id: null,
    role_type: "none",
    settlement_id: "settlement-1",
    sex: null,
    skills_text: null,
    status: "alive",
    updated_at: "2026-01-01T00:00:00Z",
    user_id: null,
    world_id: "world-1",
    ...overrides,
  };
}

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
      deposit_types: { name: "Iron", job: { name: "Miner" } },
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
    deposit_types: { job: { name: "Miner" }, name: "Iron" },
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
      culling_job: { name: "Slaughter" },
      husbandry_job: { name: "Shepherd" },
      name: "Sheep",
    },
    name: "Flock A",
    settlement_id: "settlement-1",
    status: "active",
    updated_at: "2026-01-01T00:00:00Z",
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

function createAggregateBuilder(rows: readonly AggregateRowFixture[]): unknown {
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

// ---------------------------------------------------------------------------
// createClient
// ---------------------------------------------------------------------------

function createClient(config: {
  // Bulk-tab config
  readonly aggregates?: readonly AggregateRowFixture[];
  readonly jobCounts?: readonly JobCountRowFixture[];
  readonly jobMutationResult?: MutationResultFixture;
  // Per-target config
  readonly citizenRows?: readonly CitizenRowFixture[];
  readonly citizenAssignmentRows?: readonly CitizenAssignmentRowFixture[];
  readonly depositInstanceRows?: readonly DepositInstanceRowFixture[];
  readonly populationInstanceRows?: readonly PopulationInstanceRowFixture[];
  readonly tradeRouteRows?: readonly TradeRouteRowFixture[];
  readonly perTargetMutationResult?: PerTargetMutationResultFixture;
}): unknown {
  const defaultMutationResult: MutationResultFixture = {
    after: 1,
    added_citizen_ids: [],
    before: 0,
    removed_citizen_ids: [],
  };

  const defaultPerTargetResult: PerTargetMutationResultFixture = {
    assigned_count: 1,
    replaced_count: 0,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "citizens") {
        if (config.citizenRows !== undefined) {
          return createTableBuilder(config.citizenRows);
        }
        return createAggregateBuilder(config.aggregates ?? []);
      }
      if (table === "citizen_assignments") {
        return createTableBuilder(config.citizenAssignmentRows ?? []);
      }
      if (table === "deposit_instances") {
        return createTableBuilder(config.depositInstanceRows ?? []);
      }
      if (table === "managed_population_instances") {
        return createTableBuilder(config.populationInstanceRows ?? []);
      }
      if (table === "trade_routes") {
        return createTableBuilder(config.tradeRouteRows ?? []);
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
      if (name === "set_per_target_assignment") {
        return createMaybeSingleBuilder(
          config.perTargetMutationResult ?? defaultPerTargetResult,
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
    activeTab: "bulk" | "per-target";
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
      <SettlementAssignmentBoard
        activeTab={props.activeTab ?? "bulk"}
        canManage={props.canManage ?? true}
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

  it("renders tab navigation with Bulk jobs and Per-target jobs tabs", () => {
    requireSupabaseClient.mockReturnValue(createClient({}));

    renderBoard();

    const bulkTab = screen.getByRole("tab", { name: "Bulk jobs" });
    const perTargetTab = screen.getByRole("tab", { name: "Per-target jobs" });
    expect(bulkTab).toBeDefined();
    expect(perTargetTab).toBeDefined();
    expect(bulkTab).toHaveAttribute("aria-selected", "true");
    expect(perTargetTab).toHaveAttribute("aria-selected", "false");
  });

  it("mobile selector reflects active tab and calls navigate with resetScroll: false on change", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({}));

    renderBoard({ activeTab: "bulk" });

    const select = screen.getByRole("combobox", { name: "Assignment view" });
    expect(select).toHaveValue("bulk");

    await user.selectOptions(select, "per-target");

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        resetScroll: false,
        search: { assignmentTab: "per-target" },
      }),
    );
  });

  it("desktop tab trigger calls navigate with resetScroll: false", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({}));

    renderBoard({ activeTab: "bulk" });

    const perTargetTab = screen.getByRole("tab", { name: "Per-target jobs" });
    await user.click(perTargetTab);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        resetScroll: false,
        search: { assignmentTab: "per-target" },
      }),
    );
  });

  it("keeps both panels mounted when the non-active tab is hidden", async () => {
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
        citizenRows: [],
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

    renderBoard({ activeTab: "per-target" });

    // Bulk panel is mounted and its data loads even though it is hidden
    expect(await screen.findByText("Farmer")).toBeDefined();
    // Per-target panel content is also present and visible
    expect(await screen.findByText("Iron Vein — Miner")).toBeDefined();
  });

  it("preserves row-level input state when switching tabs and returning", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

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
        citizenRows: [],
        citizenAssignmentRows: [],
        depositInstanceRows: [],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    const defaultProps = {
      canManage: true,
      isArchived: false,
      nationId: "nation-1",
      settlementId: "settlement-1",
      worldId: "world-1",
    };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <SettlementAssignmentBoard activeTab="bulk" {...defaultProps} />
      </QueryClientProvider>,
    );

    await screen.findByText("Farmer");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    await user.clear(input);
    await user.type(input, "7");
    expect(input).toHaveValue(7);

    rerender(
      <QueryClientProvider client={queryClient}>
        <SettlementAssignmentBoard activeTab="per-target" {...defaultProps} />
      </QueryClientProvider>,
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <SettlementAssignmentBoard activeTab="bulk" {...defaultProps} />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("spinbutton", { name: "Target count for Farmer" }),
    ).toHaveValue(7);
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

  it("shows inline editor with Apply button when canManage and not archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManage: true, isArchived: false });

    await screen.findByText("Farmer");
    expect(screen.getByRole("button", { name: "Apply" })).toBeDefined();
  });

  it("hides the editor when isArchived is true", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManage: true, isArchived: true });

    await screen.findByText("Farmer");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("hides the editor when canManage is false", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManage: false, isArchived: false });

    await screen.findByText("Farmer");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("shows Unassigned row as first row in standard jobs table", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: null,
          }),
          createAggregateRow({
            id: "c-2",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: null,
          }),
          createAggregateRow({
            id: "c-3",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: [{ assignment_type: "standard_job" }],
          }),
        ],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard();

    await screen.findByText("Farmer");
    const rows = screen.getAllByRole("row");
    // rows[0] is the header; rows[1] is the first data row
    expect(rows[1]).toHaveTextContent("Unassigned");
    expect(rows[1]).toHaveTextContent("2");
    expect(rows[1]).toHaveTextContent("∞");
  });

  it("Unassigned row appears first even when other job names sort alphabetically earlier", async () => {
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
    expect(rows[1]).toHaveTextContent("Unassigned");
    expect(rows[2]).toHaveTextContent("Archer");
    expect(rows[3]).toHaveTextContent("Baker");
  });

  it("Unassigned row has no Set count editor when canEdit is true", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard({ canManage: true });

    await screen.findByText("Farmer");
    const rows = screen.getAllByRole("row");
    const unassignedRow = rows[1];
    expect(unassignedRow).toHaveTextContent("Unassigned");
    expect(unassignedRow).not.toContainElement(
      unassignedRow.querySelector("input"),
    );
    expect(unassignedRow).not.toContainElement(
      unassignedRow.querySelector("button"),
    );
  });

  it("Unassigned count shows only NPC count, excluding player characters", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: null,
          }),
          createAggregateRow({
            id: "c-2",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: null,
          }),
          createAggregateRow({
            id: "c-3",
            citizen_type: "player_character",
            status: "alive",
            citizen_assignments: null,
          }),
        ],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
      }),
    );

    renderBoard();

    await screen.findByText("Farmer");
    const rows = screen.getAllByRole("row");
    const unassignedRow = rows[1];
    // 2 NPCs unassigned; the PC is not counted
    expect(unassignedRow).toHaveTextContent("2");
    // The total including the PC (3) should not appear in the Unassigned row
    expect(unassignedRow).not.toHaveTextContent("3 /");
  });

  it("construction workers are not counted as unassigned", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            id: "c-1",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: null,
          }),
          createAggregateRow({
            id: "c-2",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: [{ assignment_type: "construction_project" }],
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
    const rows = screen.getAllByRole("row");
    const unassignedRow = rows[1];
    // Only 1 truly unassigned NPC; the construction worker is assigned
    expect(unassignedRow).toHaveTextContent("1");
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

    renderBoard({ canManage: true });

    await screen.findByText("Farmer");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    await user.clear(input);
    await user.type(input, "5");

    const applyButton = screen.getByRole("button", { name: "Apply" });
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
            citizen_assignments: null,
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

    renderBoard({ canManage: true });

    await screen.findByText("Farmer");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    await user.clear(input);
    await user.type(input, "5");

    const applyButton = screen.getByRole("button", { name: "Apply" });
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

    renderBoard({ canManage: true });

    await screen.findByText("Farmer");

    const input = screen.getByRole("spinbutton", {
      name: "Target count for Farmer",
    });
    await user.clear(input);
    await user.type(input, "1");

    const applyButton = screen.getByRole("button", { name: "Apply" });
    expect(applyButton).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // Per-target tab tests
  // -------------------------------------------------------------------------

  it("shows deposit section with deposit name and capacity hint on per-target tab", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
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

    renderBoard({ activeTab: "per-target" });

    expect(await screen.findByText("Iron Vein — Miner")).toBeDefined();
    expect(screen.getByText("0 / 4")).toBeDefined();
  });

  it("shows deposit capacity as assigned count only when max_workers is null", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
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

    renderBoard({ activeTab: "per-target" });

    expect(await screen.findByText("Coal Seam — Miner")).toBeDefined();
    expect(screen.getByText("0 assigned")).toBeDefined();
  });

  it("shows husbandry section with population name and job name", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
        citizenAssignmentRows: [],
        depositInstanceRows: [],
        populationInstanceRows: [
          createPopulationInstanceRow({
            id: "pop-1",
            name: "Flock A",
            managed_population_types: {
              culling_job: { name: "Slaughter" },
              husbandry_job: { name: "Shepherd" },
              name: "Sheep",
            },
          }),
        ],
        tradeRouteRows: [],
      }),
    );

    renderBoard({ activeTab: "per-target" });

    expect(await screen.findByText("Flock A — Shepherd")).toBeDefined();
  });

  it("shows culling section with population name and culling job name", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
        citizenAssignmentRows: [],
        depositInstanceRows: [],
        populationInstanceRows: [
          createPopulationInstanceRow({
            id: "pop-1",
            name: "Flock A",
            managed_population_types: {
              culling_job: { name: "Slaughter" },
              husbandry_job: { name: "Shepherd" },
              name: "Sheep",
            },
          }),
        ],
        tradeRouteRows: [],
      }),
    );

    renderBoard({ activeTab: "per-target" });

    expect(await screen.findByText("Flock A — Slaughter")).toBeDefined();
  });

  it("shows trade route section with origin and destination labels", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
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

    renderBoard({ activeTab: "per-target" });

    await screen.findByText(/Hillfort.*Riverside|Riverside.*Hillfort/);
    expect(screen.getByText("Trader: Grain → Riverside")).toBeDefined();
    expect(
      screen.getByText(/Trader \(receiving — remote\): Riverside/),
    ).toBeDefined();
  });

  it("shows assigned citizen name as tag on deposit row", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [
          createCitizenRow({ id: "citizen-1", name: "Alice", status: "alive" }),
        ],
        citizenAssignmentRows: [
          createCitizenAssignmentRow({
            citizen_id: "citizen-1",
            assignment_type: "deposit",
            deposit_instance: {
              id: "dep-1",
              name: "Iron Vein",
              deposit_types: { name: "Iron", job: { name: "Miner" } },
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

    renderBoard({ activeTab: "per-target" });

    expect(await screen.findByText("Alice")).toBeDefined();
  });

  it("shows Assign citizens button when canManage and not archived on per-target tab", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({
      activeTab: "per-target",
      canManage: true,
      isArchived: false,
    });

    await screen.findByText("Iron Vein — Miner");
    expect(
      screen.getByRole("button", { name: "Assign citizens" }),
    ).toBeDefined();
  });

  it("hides Assign citizens button on per-target tab when canManage is false", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({
      activeTab: "per-target",
      canManage: false,
      isArchived: false,
    });

    await screen.findByText("Iron Vein — Miner");
    expect(
      screen.queryByRole("button", { name: "Assign citizens" }),
    ).toBeNull();
  });

  it("hides Assign citizens button on per-target tab when isArchived is true", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({ activeTab: "per-target", canManage: true, isArchived: true });

    await screen.findByText("Iron Vein — Miner");
    expect(
      screen.queryByRole("button", { name: "Assign citizens" }),
    ).toBeNull();
  });

  it("filters out non-active deposits and populations from per-target sections", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [],
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

    renderBoard({ activeTab: "per-target" });

    expect(await screen.findByText("Active Vein — Miner")).toBeDefined();
    expect(screen.queryByText("Depleted Vein")).toBeNull();
  });

  it("shows assign dialog with alive citizens pre-selected when Assign citizens is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [
          createCitizenRow({ id: "citizen-1", name: "Alice", status: "alive" }),
          createCitizenRow({ id: "citizen-2", name: "Bob", status: "alive" }),
        ],
        citizenAssignmentRows: [
          createCitizenAssignmentRow({
            citizen_id: "citizen-1",
            assignment_type: "deposit",
            deposit_instance: {
              id: "dep-1",
              name: "Iron Vein",
              deposit_types: { name: "Iron", job: { name: "Miner" } },
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

    renderBoard({ activeTab: "per-target", canManage: true });

    await screen.findByText("Iron Vein — Miner");
    await user.click(screen.getByRole("button", { name: "Assign citizens" }));

    expect(screen.getByRole("dialog")).toBeDefined();
    const aliceCheckbox = screen.getByRole("checkbox", { name: /Alice/ });
    const bobCheckbox = screen.getByRole("checkbox", { name: /Bob/ });
    expect(aliceCheckbox).toBeChecked();
    expect(bobCheckbox).not.toBeChecked();
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
            citizen_assignments: null,
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
          activeTab="bulk"
          canManage={true}
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
    await user.click(screen.getByRole("button", { name: "Apply" }));

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
  });

  it("filters player characters out of the assign dialog, showing only NPCs", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizenRows: [
          createCitizenRow({
            id: "npc-1",
            name: "Alice",
            citizen_type: "npc",
            status: "alive",
          }),
          createCitizenRow({
            id: "pc-1",
            name: "HeroPC",
            citizen_type: "player_character",
            status: "alive",
          }),
        ],
        citizenAssignmentRows: [],
        depositInstanceRows: [
          createDepositInstanceRow({ id: "dep-1", name: "Iron Vein" }),
        ],
        populationInstanceRows: [],
        tradeRouteRows: [],
      }),
    );

    renderBoard({ activeTab: "per-target", canManage: true });

    await screen.findByText("Iron Vein — Miner");
    await user.click(screen.getByRole("button", { name: "Assign citizens" }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /Alice/ })).toBeDefined();
    expect(screen.queryByRole("checkbox", { name: /HeroPC/ })).toBeNull();
  });
});
