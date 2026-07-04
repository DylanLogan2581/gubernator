import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CitizensDirectoryTable } from "./CitizensDirectoryTable";

const { navigateMock, requireSupabaseClient } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

type TableRow = Record<string, unknown>;

// Generic chainable stub: every filter/order/range method returns itself so
// callers can chain in any order, and `.returns()` resolves with whatever
// payload was registered for that table's `.from(...)` call.
function chainable(resolved: {
  readonly data: readonly TableRow[];
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

function buildClient({
  citizens,
  nations = [],
  settlements = [],
  totalCount,
}: {
  readonly citizens: readonly TableRow[];
  readonly nations?: readonly TableRow[];
  readonly settlements?: readonly TableRow[];
  readonly totalCount: number;
}): unknown {
  const from = vi.fn((table: string) => {
    if (table === "citizen_directory_view") {
      return {
        select: vi.fn(() =>
          chainable({ count: totalCount, data: citizens, error: null }),
        ),
      };
    }
    if (table === "nations") {
      return {
        select: vi.fn(() => chainable({ data: nations, error: null })),
      };
    }
    return {
      select: vi.fn(() => chainable({ data: settlements, error: null })),
    };
  });
  return { from };
}

function renderTable(worldId = "world-1"): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CitizensDirectoryTable worldId={worldId} />
    </QueryClientProvider>,
  );
}

describe("CitizensDirectoryTable", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    requireSupabaseClient.mockReset();
  });

  it("renders directory rows with the required columns", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient({
        citizens: [
          {
            age_turns: 12,
            assignment_label: "Blacksmith",
            citizen_type: "npc",
            id: "citizen-1",
            name: "Ada",
            nation_id: "nation-1",
            nation_name: "Nation A",
            settlement_id: "settlement-1",
            settlement_name: "Amberhold",
            sex: "female",
            status: "alive",
          },
        ],
        totalCount: 1,
      }),
    );

    renderTable();

    expect(await screen.findByText("Ada")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("Amberhold")).toBeDefined();
    expect(screen.getByText("Nation A")).toBeDefined();
    expect(screen.getByText("Blacksmith")).toBeDefined();
    expect(screen.getByText("NPC")).toBeDefined();
    expect(screen.getByText("Alive")).toBeDefined();
  });

  it("renders an empty state when no citizens match", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient({ citizens: [], totalCount: 0 }),
    );

    renderTable();

    expect(await screen.findByText("No citizens found")).toBeDefined();
  });

  it("navigates to the citizen detail page when a row is clicked", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient({
        citizens: [
          {
            age_turns: null,
            assignment_label: null,
            citizen_type: "player_character",
            id: "citizen-2",
            name: "Bram",
            nation_id: null,
            nation_name: null,
            settlement_id: null,
            settlement_name: null,
            sex: null,
            status: "alive",
          },
        ],
        totalCount: 1,
      }),
    );

    renderTable();

    const nameCell = await screen.findByText("Bram");
    const user = userEvent.setup();
    await user.click(nameCell);

    expect(navigateMock).toHaveBeenCalledWith({
      params: { citizenId: "citizen-2", worldId: "world-1" },
      to: "/worlds/$worldId/citizens/$citizenId",
    });
  });
});
