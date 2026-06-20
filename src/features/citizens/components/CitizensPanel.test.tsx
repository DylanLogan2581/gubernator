import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CitizensPanel } from "./CitizensPanel";

import type { ReactNode } from "react";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
    readonly className?: string;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

type CitizenRowFixture = {
  readonly born_on_turn_number: number | null;
  readonly citizen_type: "npc" | "player_character";
  readonly created_at: string;
  readonly death_cause: string | null;
  readonly id: string;
  readonly name: string;
  readonly npc_flaw: string | null;
  readonly npc_goal: string | null;
  readonly npc_secret_contradiction: string | null;
  readonly npc_trait_1: string | null;
  readonly npc_trait_2: string | null;
  readonly parent_a_citizen_id: string | null;
  readonly parent_b_citizen_id: string | null;
  readonly personality_text: string | null;
  readonly profile_photo_url: string | null;
  readonly role_nation_id: string | null;
  readonly role_settlement_id: string | null;
  readonly role_type: "none" | "nation_manager" | "settlement_manager";
  readonly settlement_id: string | null;
  readonly sex: string | null;
  readonly skills_text: string | null;
  readonly status: "alive" | "dead";
  readonly updated_at: string;
  readonly user_id: string | null;
  readonly world_id: string;
};

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

type AssignmentRowFixture = {
  readonly assigned_on_turn_number: number;
  readonly assignment_type:
    | "construction_project"
    | "culling"
    | "deposit"
    | "husbandry"
    | "standard_job"
    | "trade_route";
  readonly citizen_id: string;
  readonly construction_project: null;
  readonly created_at: string;
  readonly deposit_instance: null;
  readonly job: { readonly id: string; readonly name: string } | null;
  readonly managed_population_instance: null;
  readonly trade_route: null;
  readonly trade_route_end: null;
  readonly updated_at: string;
};

describe("CitizensPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders individual citizens for world admins, hiding the deceased by default", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizens: [
          createCitizenRow({ id: "c-1", name: "Aldra" }),
          createCitizenRow({
            citizen_type: "player_character",
            id: "c-2",
            name: "Brann",
          }),
          createCitizenRow({
            death_cause: "fever",
            id: "c-3",
            name: "Cael",
            status: "dead",
          }),
        ],
        assignments: [
          createAssignmentRow({
            assignment_type: "standard_job",
            citizen_id: "c-1",
            job: { id: "j-1", name: "Brewer" },
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: true });

    expect(await screen.findByText("Aldra")).toBeDefined();
    expect(screen.getByText("Brann")).toBeDefined();
    expect(screen.queryByText("Cael")).toBeNull();

    const aldraRow = screen.getByText("Aldra").closest("li");
    expect(aldraRow).toHaveTextContent("Brewer");

    const brannRow = screen.getByText("Brann").closest("li");
    expect(brannRow).toHaveTextContent("Unassigned");
    expect(brannRow).toHaveTextContent("Player character");

    await user.click(screen.getByLabelText("Show deceased"));

    expect(await screen.findByText("Cael")).toBeDefined();
    const caelRow = screen.getByText("Cael").closest("li");
    expect(caelRow).toHaveTextContent("Deceased");

    // Dead toggle shows only dead and hides create buttons
    expect(screen.queryByText("Aldra")).toBeNull();
    expect(screen.queryByText("Brann")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create NPC" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create player character" }),
    ).toBeNull();
  });

  it("exposes Create NPC and Create player character actions for world admins on active worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizens: [createCitizenRow({ id: "c-1", name: "Aldra" })],
        assignments: [],
      }),
    );

    renderPanel({ canAdmin: true });

    const npcButton = await screen.findByRole("button", { name: "Create NPC" });
    const pcButton = screen.getByRole("button", {
      name: "Create player character",
    });
    expect(npcButton).not.toBeDisabled();
    expect(pcButton).not.toBeDisabled();
  });

  it("disables the create actions when the world is archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        citizens: [createCitizenRow({ id: "c-1", name: "Aldra" })],
        assignments: [],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: true });

    const npcButton = await screen.findByRole("button", { name: "Create NPC" });
    expect(npcButton).toBeDisabled();
    expect(npcButton).toHaveAttribute(
      "title",
      "Creating citizens is disabled because this world is archived.",
    );
  });

  it("renders aggregate counts for non-admin roles without listing citizens", async () => {
    // Non-admins receive only player_character rows from the DB after RLS
    // restricts NPC visibility to world/super admins. The mock reflects that.
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            citizen_assignments: [{ assignment_type: "standard_job" }],
            citizen_type: "player_character",
            id: "c-1",
            status: "alive",
          }),
          createAggregateRow({
            citizen_assignments: [{ assignment_type: "husbandry" }],
            citizen_type: "player_character",
            id: "c-2",
            status: "alive",
          }),
          createAggregateRow({
            citizen_assignments: null,
            citizen_type: "player_character",
            id: "c-3",
            status: "alive",
          }),
          createAggregateRow({
            citizen_assignments: null,
            citizen_type: "player_character",
            id: "c-4",
            status: "dead",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false });

    expect(await screen.findByText("Living citizens")).toBeDefined();

    expectMetric("Living citizens", "3");
    expectMetric("Player characters", "4");

    expectBreakdownRow("Standard job", "1");
    expectBreakdownRow("Husbandry", "1");
    expectBreakdownRow("Unassigned", "2");

    expect(screen.queryByText("c-1")).toBeNull();
    expect(screen.queryByRole("list", { name: "Citizens" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create NPC" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create player character" }),
    ).toBeNull();
  });

  it("shows living count and population cap in the panel header", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({ id: "c-1", status: "alive" }),
          createAggregateRow({ id: "c-2", status: "alive" }),
          createAggregateRow({ id: "c-3", status: "dead" }),
        ],
        populationCap: 10,
      }),
    );

    renderPanel({ canAdmin: false });

    expect(await screen.findByText("2 / 10")).toBeDefined();
  });

  it("shows living count without cap when the population cap rpc fails", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({ id: "c-1", status: "alive" }),
          createAggregateRow({ id: "c-2", status: "alive" }),
        ],
        populationCap: null,
      }),
    );

    renderPanel({ canAdmin: false });

    // Wait for data to load, then verify header count paragraph shows count without cap
    await screen.findByText("Living citizens");
    const heading = screen.getByRole("heading", { name: "Citizens" });
    const headerDiv = heading.parentElement;
    const countEl = headerDiv?.querySelector("p");
    expect(countEl?.textContent).toBe("2");
  });

  it("shows at-capacity indicator when living count meets or exceeds the cap", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({ id: "c-1", status: "alive" }),
          createAggregateRow({ id: "c-2", status: "alive" }),
        ],
        populationCap: 2,
      }),
    );

    renderPanel({ canAdmin: false });

    expect(await screen.findByText("2 / 2 — at capacity")).toBeDefined();
  });

  it("shows an empty aggregate state when the settlement has no citizens", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ aggregates: [] }));

    renderPanel({ canAdmin: false });

    expect(await screen.findByText("No citizens yet")).toBeDefined();
  });

  it("surfaces citizen list query errors for admins", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        assignments: [],
        citizens: [],
        citizensError: new Error("Citizens unavailable."),
      }),
    );

    renderPanel({ canAdmin: true });

    expect(
      await screen.findByText("Citizens could not be loaded"),
    ).toBeDefined();
    expect(screen.getByText("Citizens unavailable.")).toBeDefined();
  });
});

function renderPanel({
  canAdmin,
  incestPreventionDepth = 4,
  isArchived = false,
}: {
  readonly canAdmin: boolean;
  readonly incestPreventionDepth?: number;
  readonly isArchived?: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CitizensPanel
        canAdmin={canAdmin}
        incestPreventionDepth={incestPreventionDepth}
        isArchived={isArchived}
        settlementId="settlement-1"
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createCitizenRow(
  overrides: Partial<CitizenRowFixture> = {},
): CitizenRowFixture {
  return {
    born_on_turn_number: null,
    citizen_type: "npc",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    id: "c-1",
    name: "Citizen",
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
    updated_at: "2026-05-01T00:00:00.000Z",
    user_id: null,
    world_id: "world-1",
    ...overrides,
  };
}

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

function createAssignmentRow(
  overrides: Partial<AssignmentRowFixture> = {},
): AssignmentRowFixture {
  return {
    assigned_on_turn_number: 1,
    assignment_type: "standard_job",
    citizen_id: "c-1",
    construction_project: null,
    created_at: "2026-05-01T00:00:00.000Z",
    deposit_instance: null,
    job: null,
    managed_population_instance: null,
    trade_route: null,
    trade_route_end: null,
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function createClient({
  aggregates = [],
  assignments = [],
  citizens = [],
  citizensError = null,
  populationCap = null,
}: {
  readonly aggregates?: readonly AggregateRowFixture[];
  readonly assignments?: readonly AssignmentRowFixture[];
  readonly citizens?: readonly CitizenRowFixture[];
  readonly citizensError?: Error | null;
  readonly populationCap?: number | null;
}): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "citizens") {
        return createCitizensQueryBuilder({
          aggregates,
          citizens,
          citizensError,
        });
      }
      if (table === "citizen_assignments") {
        return createAssignmentsQueryBuilder(assignments);
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: vi.fn((fn: string) => {
      if (fn === "settlement_population_cap") {
        return Promise.resolve(
          populationCap !== null
            ? { data: populationCap, error: null }
            : { data: null, error: new Error("Cap unavailable") },
        );
      }
      return Promise.resolve({
        data: null,
        error: new Error(`Unexpected rpc ${fn}`),
      });
    }),
  };
}

function createCitizensQueryBuilder({
  aggregates,
  citizens,
  citizensError,
}: {
  readonly aggregates: readonly AggregateRowFixture[];
  readonly citizens: readonly CitizenRowFixture[];
  readonly citizensError: Error | null;
}): unknown {
  return {
    select: vi.fn((selection: string) => {
      const isAggregate = selection.includes("citizen_assignments");
      const data = isAggregate ? aggregates : citizens;
      const builder = {
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        returns: vi.fn().mockResolvedValue({
          data,
          error: isAggregate ? null : citizensError,
        }),
      };
      return builder;
    }),
  };
}

function createAssignmentsQueryBuilder(
  assignments: readonly AssignmentRowFixture[],
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn().mockResolvedValue({ data: assignments, error: null }),
  };
  return {
    select: vi.fn(() => builder),
  };
}

function expectMetric(label: string, value: string): void {
  const term = screen.getByText(label);
  const group = term.closest("div");
  expect(group).not.toBeNull();
  expect(group).toHaveTextContent(value);
}

function expectBreakdownRow(label: string, value: string): void {
  const list = screen.getByLabelText("Assignment breakdown");
  const item = Array.from(list.querySelectorAll("li")).find((li) =>
    li.textContent?.includes(label),
  );
  expect(item).toBeDefined();
  expect(item).toHaveTextContent(value);
}
