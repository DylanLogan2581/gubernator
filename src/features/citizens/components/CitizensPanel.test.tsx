import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { CitizensPanel } from "./CitizensPanel";

import type { ReactNode } from "react";

// jsdom lacks pointer capture / scrollIntoView, which Radix Select needs to open.
/* eslint-disable @typescript-eslint/unbound-method */
Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
  return false;
};
Element.prototype.setPointerCapture ??= function setPointerCapture() {};
Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
/* eslint-enable @typescript-eslint/unbound-method */

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

type DirectoryRowFixture = {
  readonly age_turns: number | null;
  readonly assignment_label: string | null;
  readonly citizen_type: "npc" | "player_character";
  readonly id: string;
  readonly name: string | null;
  readonly nation_id: string | null;
  readonly nation_name: string | null;
  readonly office_types: string | null;
  readonly settlement_id: string | null;
  readonly settlement_name: string | null;
  readonly sex: string | null;
  readonly status: "alive" | "dead";
};

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

// Generic chainable stub: every filter/order/range method returns itself so
// callers can chain in any order, and `.returns()` resolves with whatever
// payload was registered for that table's `.from(...)` call.
function chainable(resolved: {
  readonly data: readonly unknown[];
  readonly error: unknown;
  readonly count?: number | null;
}): Record<string, ReturnType<typeof vi.fn>> {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["eq", "ilike", "order", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.returns = vi.fn(() => Promise.resolve(resolved));
  return builder;
}

describe("CitizensPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders individual citizens for world admins, hiding the deceased by default", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        directoryRows: [
          createDirectoryRow({
            assignment_label: "Brewer",
            id: "c-1",
            name: "Aldra",
          }),
          createDirectoryRow({
            citizen_type: "player_character",
            id: "c-2",
            name: "Brann",
          }),
        ],
        totalCount: 2,
      }),
    );

    renderPanel({ canAdmin: true });

    expect(await screen.findByText("Aldra")).toBeDefined();
    expect(screen.getByText("Brann")).toBeDefined();

    const aldraRow = screen.getByText("Aldra").closest("tr");
    expect(aldraRow).toHaveTextContent("Brewer");

    const brannRow = screen.getByText("Brann").closest("tr");
    expect(brannRow).toHaveTextContent("Unassigned");
    expect(brannRow).toHaveTextContent("Player character");

    requireSupabaseClient.mockReturnValue(
      createClient({
        directoryRows: [
          createDirectoryRow({ id: "c-3", name: "Cael", status: "dead" }),
        ],
        totalCount: 1,
      }),
    );

    await user.click(
      screen.getByRole("combobox", { name: "Filter by status" }),
    );
    await user.click(await screen.findByRole("option", { name: "Deceased" }));

    expect(await screen.findByText("Cael")).toBeDefined();
    const caelRow = screen.getByText("Cael").closest("tr");
    expect(caelRow).toHaveTextContent("Deceased");

    // Deceased filter shows only dead and hides create buttons
    expect(screen.queryByText("Aldra")).toBeNull();
    expect(screen.queryByText("Brann")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create NPC" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create player character" }),
    ).toBeNull();
  });

  it("filters by name search and citizen type", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        directoryRows: [createDirectoryRow({ id: "c-1", name: "Aldra" })],
        totalCount: 1,
      }),
    );

    const user = userEvent.setup();
    renderPanel({ canAdmin: true });

    expect(await screen.findByText("Aldra")).toBeDefined();

    await user.type(screen.getByLabelText("Search citizens by name"), "Ald");

    await waitFor(() => {
      expect(requireSupabaseClient).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("combobox", { name: "Filter by type" }));
    await user.click(
      await screen.findByRole("option", { name: "Player characters" }),
    );

    expect(
      screen.getByRole("combobox", { name: "Filter by type" }),
    ).toHaveTextContent("Player characters");
  });

  it("marks an officeholder with an 'In office' badge instead of their assignment label", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        directoryRows: [
          createDirectoryRow({
            assignment_label: "Brewer",
            id: "c-1",
            name: "Aldra",
            office_types: "treasurer",
          }),
        ],
        totalCount: 1,
      }),
    );

    renderPanel({ canAdmin: true });

    expect(await screen.findByText("Aldra")).toBeDefined();
    const aldraRow = screen.getByText("Aldra").closest("tr");
    expect(aldraRow).toHaveTextContent("In office: Treasurer");
    expect(aldraRow).not.toHaveTextContent("Brewer");
  });

  it("exposes Create NPC and Create player character actions for world admins on active worlds", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        directoryRows: [createDirectoryRow({ id: "c-1", name: "Aldra" })],
        totalCount: 1,
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
        directoryRows: [createDirectoryRow({ id: "c-1", name: "Aldra" })],
        totalCount: 1,
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
            assignment_type: "standard_job",
            citizen_type: "player_character",
            id: "c-1",
            status: "alive",
          }),
          createAggregateRow({
            assignment_type: "husbandry",
            citizen_type: "player_character",
            id: "c-2",
            status: "alive",
          }),
          createAggregateRow({
            assignment_type: null,
            citizen_type: "player_character",
            id: "c-3",
            status: "alive",
          }),
          createAggregateRow({
            assignment_type: null,
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
    expectBreakdownRow("Unassigned", "1");

    expect(screen.queryByText("c-1")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create NPC" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Create player character" }),
    ).toBeNull();
  });

  it("hides zero-count assignment categories from the breakdown", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            assignment_type: "standard_job",
            id: "c-1",
            status: "alive",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false });

    expect(await screen.findByText("Living citizens")).toBeDefined();

    const list = screen.getByLabelText("Assignment breakdown");
    const labels = Array.from(list.querySelectorAll("li")).map(
      (li) => li.textContent,
    );
    expect(labels).toEqual(["Standard job1"]);
  });

  it("shows a warning CTA linking to job assignments when unassigned dominates", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            assignment_type: "standard_job",
            id: "c-1",
            status: "alive",
          }),
          ...Array.from({ length: 3 }, (_unused, index) =>
            createAggregateRow({
              assignment_type: null,
              id: `unassigned-${String(index)}`,
              status: "alive",
            }),
          ),
        ],
      }),
    );

    renderPanel({ canAdmin: false });

    const warning = await screen.findByRole("link", {
      name: /3 unassigned — assign jobs/,
    });
    expect(warning).toHaveAttribute(
      "href",
      "/worlds/world-1/nations/nation-1/settlements/settlement-1/assignments",
    );
  });

  it("does not show the warning CTA when unassigned is a minority", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        aggregates: [
          createAggregateRow({
            assignment_type: "standard_job",
            id: "c-1",
            status: "alive",
          }),
          createAggregateRow({
            assignment_type: "husbandry",
            id: "c-2",
            status: "alive",
          }),
          createAggregateRow({
            assignment_type: null,
            id: "c-3",
            status: "alive",
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false });

    expect(await screen.findByText("Living citizens")).toBeDefined();
    expect(
      screen.queryByRole("link", { name: /unassigned — assign jobs/ }),
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
    const heading = screen.getByRole("heading", { name: "Citizen summary" });
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
        directoryError: new Error("Citizens unavailable."),
        directoryRows: [],
        totalCount: 0,
      }),
    );

    renderPanel({ canAdmin: true });

    expect(
      await screen.findByText("Citizens could not be loaded"),
    ).toBeDefined();
    expect(screen.getByText("Citizens unavailable.")).toBeDefined();
  });

  it("links to the settlement's job assignments route", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        directoryRows: [createDirectoryRow({ id: "c-1", name: "Aldra" })],
        totalCount: 1,
      }),
    );

    renderPanel({ canAdmin: true });

    const link = await screen.findByRole("link", { name: /Job assignments/ });
    expect(link.getAttribute("href")).toBe(
      "/worlds/world-1/nations/nation-1/settlements/settlement-1/assignments",
    );
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
      <TooltipProvider>
        <CitizensPanel
          canAdmin={canAdmin}
          incestPreventionDepth={incestPreventionDepth}
          isArchived={isArchived}
          nationId="nation-1"
          settlementId="settlement-1"
          worldId="world-1"
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createDirectoryRow(
  overrides: Partial<DirectoryRowFixture> = {},
): DirectoryRowFixture {
  return {
    age_turns: null,
    assignment_label: null,
    citizen_type: "npc",
    id: "c-1",
    name: "Citizen",
    nation_id: "nation-1",
    nation_name: "Nation",
    office_types: null,
    settlement_id: "settlement-1",
    settlement_name: "Settlement",
    sex: null,
    status: "alive",
    ...overrides,
  };
}

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

function createClient({
  aggregates = [],
  directoryError = null,
  directoryRows = [],
  populationCap = null,
  totalCount = 0,
}: {
  readonly aggregates?: readonly AggregateRowFixture[];
  readonly directoryError?: Error | null;
  readonly directoryRows?: readonly DirectoryRowFixture[];
  readonly populationCap?: number | null;
  readonly totalCount?: number;
}): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "citizen_directory_view") {
        return {
          // citizen_directory_view backs the paginated directory query
          // ({ count: "exact" }), the aggregate stats query (no count
          // option), and the officeholder count query ({ head: true }) --
          // dispatch on the select options to route each to its fixture.
          select: vi.fn(
            (
              _columns?: string,
              opts?: { readonly count?: string; readonly head?: boolean },
            ) => {
              if (opts?.head === true) {
                return chainable({ count: 0, data: [], error: null });
              }
              if (opts?.count === "exact") {
                return chainable({
                  count: totalCount,
                  data: directoryRows,
                  error: directoryError,
                });
              }
              return chainable({ data: aggregates, error: null });
            },
          ),
        };
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
