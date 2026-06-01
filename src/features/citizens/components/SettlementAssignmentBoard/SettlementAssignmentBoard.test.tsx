import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementAssignmentBoard } from "./index";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

type ProjectCountRowFixture = {
  readonly construction_project_id: string;
  readonly status: string;
  readonly queue_position: number;
  readonly current_count: number;
  readonly building_blueprint_id: string;
  readonly target_tier_id: string;
};

type ConstructionProjectRowFixture = {
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
  readonly status:
    | "cancelled"
    | "complete"
    | "in_progress"
    | "paused"
    | "queued";
  readonly target_tier_id: string;
  readonly updated_at: string;
};

type MutationResultFixture = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
};

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

function createProjectCountRow(
  overrides: Partial<ProjectCountRowFixture> = {},
): ProjectCountRowFixture {
  return {
    building_blueprint_id: "bp-1",
    construction_project_id: "proj-1",
    current_count: 2,
    queue_position: 1,
    status: "in_progress",
    target_tier_id: "tier-1",
    ...overrides,
  };
}

function createConstructionProjectRow(
  overrides: Partial<ConstructionProjectRowFixture> = {},
): ConstructionProjectRowFixture {
  return {
    activated_on_turn_number: null,
    building_blueprint_id: "bp-1",
    building_blueprint_tiers: { tier_number: 1, worker_turns_required: 100 },
    building_blueprints: { name: "Granary" },
    completed_in_transition_id: null,
    created_at: "2026-05-01T00:00:00Z",
    id: "proj-1",
    progress_worker_turns: 20,
    queue_position: 1,
    settlement_id: "settlement-1",
    status: "in_progress",
    target_tier_id: "tier-1",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

function createClient(config: {
  readonly aggregates?: readonly AggregateRowFixture[];
  readonly jobCounts?: readonly JobCountRowFixture[];
  readonly projectCounts?: readonly ProjectCountRowFixture[];
  readonly constructionProjects?: readonly ConstructionProjectRowFixture[];
  readonly jobMutationResult?: MutationResultFixture;
  readonly constructionMutationResult?: MutationResultFixture;
}): unknown {
  const defaultMutationResult: MutationResultFixture = {
    after: 1,
    added_citizen_ids: [],
    before: 0,
    removed_citizen_ids: [],
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "citizens") {
        return createAggregateBuilder(config.aggregates ?? []);
      }
      if (table === "construction_projects") {
        return createFromBuilder(config.constructionProjects ?? []);
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn((name: string) => {
      if (name === "get_settlement_standard_job_counts") {
        return createRpcBuilder(config.jobCounts ?? []);
      }
      if (name === "get_settlement_construction_project_counts") {
        return createRpcBuilder(config.projectCounts ?? []);
      }
      if (name === "set_bulk_standard_job_assignment") {
        return createMaybeSingleBuilder(
          config.jobMutationResult ?? defaultMutationResult,
        );
      }
      if (name === "set_bulk_construction_assignment") {
        return createMaybeSingleBuilder(
          config.constructionMutationResult ?? defaultMutationResult,
        );
      }
      throw new Error(`Unexpected RPC: ${name}`);
    }),
  };
}

function createAggregateBuilder(rows: readonly AggregateRowFixture[]): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    select: vi.fn(() => builder),
  };
}

function createFromBuilder(rows: readonly unknown[]): unknown {
  const builder = {
    eq: vi.fn(() => builder),
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

function renderBoard(
  props: Partial<{
    canManage: boolean;
    isArchived: boolean;
    settlementId: string;
  }> = {},
): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <SettlementAssignmentBoard
        canManage={props.canManage ?? true}
        isArchived={props.isArchived ?? false}
        settlementId={props.settlementId ?? "settlement-1"}
      />
    </QueryClientProvider>,
  );
}

describe("SettlementAssignmentBoard", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders tab shell with Bulk jobs and Per-target jobs tabs", () => {
    requireSupabaseClient.mockReturnValue(createClient({}));

    renderBoard();

    expect(screen.getByRole("tab", { name: "Bulk jobs" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Per-target jobs" })).toBeDefined();
    expect(
      screen
        .getByRole("tab", { name: "Bulk jobs" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("shows per-target stub when Per-target jobs tab is clicked", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(createClient({}));

    renderBoard();

    await user.click(screen.getByRole("tab", { name: "Per-target jobs" }));

    expect(
      screen.getByText("Per-target job assignments are not yet available."),
    ).toBeDefined();
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
        projectCounts: [],
        constructionProjects: [],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Farmer")).toBeDefined();
    expect(screen.getByText("3 / 10")).toBeDefined();
    expect(screen.getByText("Miner")).toBeDefined();
    expect(screen.getByText("1 / 5")).toBeDefined();
  });

  it("shows construction project rows with blueprint name and tier", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [],
        projectCounts: [
          createProjectCountRow({
            construction_project_id: "proj-1",
            current_count: 2,
            status: "in_progress",
          }),
        ],
        constructionProjects: [
          createConstructionProjectRow({
            building_blueprints: { name: "Granary" },
            building_blueprint_tiers: {
              tier_number: 2,
              worker_turns_required: 100,
            },
            id: "proj-1",
          }),
        ],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Granary (Tier 2)")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
  });

  it("filters out complete and cancelled construction projects", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [],
        projectCounts: [
          createProjectCountRow({
            construction_project_id: "proj-complete",
            status: "complete",
          }),
          createProjectCountRow({
            construction_project_id: "proj-cancelled",
            status: "cancelled",
          }),
          createProjectCountRow({
            construction_project_id: "proj-active",
            current_count: 3,
            status: "in_progress",
          }),
        ],
        constructionProjects: [
          createConstructionProjectRow({
            id: "proj-active",
            building_blueprints: { name: "Smithy" },
          }),
        ],
      }),
    );

    renderBoard();

    expect(await screen.findByText("Smithy (Tier 1)")).toBeDefined();
    expect(screen.queryByText("proj-complete")).toBeNull();
    expect(screen.queryByText("proj-cancelled")).toBeNull();
  });

  it("shows inline editor with Apply button when canManage and not archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
        projectCounts: [],
        constructionProjects: [],
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
        projectCounts: [],
        constructionProjects: [],
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
        projectCounts: [],
        constructionProjects: [],
      }),
    );

    renderBoard({ canManage: false, isArchived: false });

    await screen.findByText("Farmer");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("removal strategy defaults to NPC-first", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [],
        jobCounts: [createJobCountRow({ job_name: "Farmer" })],
        projectCounts: [],
        constructionProjects: [],
      }),
    );

    renderBoard({ canManage: true });

    await screen.findByText("Farmer");
    const select = screen.getByRole("combobox", {
      name: "Removal strategy for Farmer",
    });
    expect(select).toHaveValue("npc_first");
  });

  it("shows unassigned footer with NPC and player character counts", async () => {
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
          createAggregateRow({
            id: "c-4",
            citizen_type: "npc",
            status: "alive",
            citizen_assignments: [{ assignment_type: "standard_job" }],
          }),
        ],
        jobCounts: [],
        projectCounts: [],
        constructionProjects: [],
      }),
    );

    renderBoard();

    const footer = await screen.findByLabelText("Unassigned citizens");
    expect(footer).toHaveTextContent("2 NPCs");
    expect(footer).toHaveTextContent("1 player character");
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
        projectCounts: [],
        constructionProjects: [],
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
        projectCounts: [],
        constructionProjects: [],
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
        projectCounts: [],
        constructionProjects: [],
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
});
