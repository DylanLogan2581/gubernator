import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { CitizensDirectoryTable } from "./CitizensDirectoryTable";

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
    params,
  }: {
    readonly children?: ReactNode;
    readonly params: { readonly citizenId: string; readonly worldId: string };
  }) => (
    <a href={`/worlds/${params.worldId}/citizens/${params.citizenId}`}>
      {children}
    </a>
  ),
}));

type TableRow = Record<string, unknown>;

// Generic chainable stub: every filter/order/range method returns itself so
// callers can chain in any order, and `.returns()` resolves with whatever
// payload was registered for that table's `.from(...)` call.
function chainable(
  resolved: {
    readonly data: readonly TableRow[];
    readonly error: unknown;
    readonly count?: number | null;
  },
  orderSpy?: (...args: unknown[]) => void,
): Record<string, ReturnType<typeof vi.fn>> {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["eq", "ilike", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.order = vi.fn((...args: unknown[]) => {
    orderSpy?.(...args);
    return builder;
  });
  builder.returns = vi.fn(() => Promise.resolve(resolved));
  return builder;
}

function buildClient({
  citizens,
  nations = [],
  settlements = [],
  totalCount,
  orderSpy,
}: {
  readonly citizens: readonly TableRow[];
  readonly nations?: readonly TableRow[];
  readonly settlements?: readonly TableRow[];
  readonly totalCount: number;
  readonly orderSpy?: (...args: unknown[]) => void;
}): unknown {
  const from = vi.fn((table: string) => {
    if (table === "citizen_directory_view") {
      return {
        select: vi.fn(() =>
          chainable(
            { count: totalCount, data: citizens, error: null },
            orderSpy,
          ),
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
      <TooltipProvider>
        <CitizensDirectoryTable worldId={worldId} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("CitizensDirectoryTable", () => {
  beforeEach(() => {
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
            office_types: null,
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
    expect(screen.queryByText("Player")).toBeNull();
    expect(screen.queryByText("Deceased")).toBeNull();
  });

  it("badges player characters and deceased citizens on the name cell", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient({
        citizens: [
          {
            age_turns: 40,
            assignment_label: null,
            citizen_type: "player_character",
            id: "citizen-3",
            name: "Cora",
            nation_id: null,
            nation_name: null,
            office_types: null,
            settlement_id: null,
            settlement_name: null,
            sex: null,
            status: "dead",
          },
        ],
        totalCount: 1,
      }),
    );

    renderTable();

    expect(await screen.findByText("Cora")).toBeDefined();
    expect(screen.getByText("Player")).toBeDefined();
    expect(screen.getByText("Deceased")).toBeDefined();
  });

  it("marks an officeholder with an 'In office' badge instead of their assignment label", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient({
        citizens: [
          {
            age_turns: 40,
            assignment_label: "Blacksmith",
            citizen_type: "npc",
            id: "citizen-4",
            name: "Deka",
            nation_id: "nation-1",
            nation_name: "Nation A",
            office_types: "treasurer",
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

    expect(await screen.findByText("Deka")).toBeDefined();
    expect(screen.getByText("In office: Treasurer")).toBeDefined();
    expect(screen.queryByText("Blacksmith")).toBeNull();
  });

  it("renders an empty state when no citizens match", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient({ citizens: [], totalCount: 0 }),
    );

    renderTable();

    expect(await screen.findByText("No citizens found")).toBeDefined();
  });

  it("renders each row's name cell as a link to the citizen detail page", async () => {
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
            office_types: null,
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

    const rowLink = await screen.findByRole("link", { name: /Bram/ });
    expect(rowLink.getAttribute("href")).toBe(
      "/worlds/world-1/citizens/citizen-2",
    );
  });

  it("re-fetches with server-side order when a sortable column header is clicked", async () => {
    const orderSpy = vi.fn();
    requireSupabaseClient.mockReturnValue(
      buildClient({
        citizens: [
          {
            age_turns: 30,
            assignment_label: null,
            citizen_type: "npc",
            id: "citizen-1",
            name: "Ada",
            nation_id: null,
            nation_name: null,
            office_types: null,
            settlement_id: null,
            settlement_name: null,
            sex: null,
            status: "alive",
          },
        ],
        totalCount: 1,
        orderSpy,
      }),
    );

    renderTable();
    await screen.findByText("Ada");
    orderSpy.mockClear();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Age/ }));

    await waitFor(() => {
      expect(orderSpy).toHaveBeenCalledWith("age_turns", { ascending: true });
    });
  });

  it("restricts the settlement options to the selected nation and resets the settlement filter on nation change", async () => {
    requireSupabaseClient.mockReturnValue(
      buildClient({
        citizens: [],
        nations: [
          { id: "nation-1", name: "Nation A" },
          { id: "nation-2", name: "Nation B" },
        ],
        settlements: [
          {
            id: "settlement-1",
            name: "Amberhold",
            nation_id: "nation-1",
            nations: { name: "Nation A" },
          },
          {
            id: "settlement-2",
            name: "Ravenshold",
            nation_id: "nation-2",
            nations: { name: "Nation B" },
          },
        ],
        totalCount: 0,
      }),
    );

    renderTable();
    await screen.findByText("No citizens found");

    const user = userEvent.setup();

    await user.click(
      screen.getByRole("combobox", { name: "Filter by settlement" }),
    );
    expect(
      await screen.findByRole("option", { name: "Amberhold" }),
    ).toBeDefined();
    expect(screen.getByRole("option", { name: "Ravenshold" })).toBeDefined();
    await user.click(screen.getByRole("option", { name: "Amberhold" }));

    await user.click(
      screen.getByRole("combobox", { name: "Filter by nation" }),
    );
    await user.click(await screen.findByRole("option", { name: "Nation B" }));

    expect(
      screen.getByRole("combobox", { name: "Filter by settlement" }),
    ).toHaveTextContent("All settlements");

    await user.click(
      screen.getByRole("combobox", { name: "Filter by settlement" }),
    );
    expect(
      await screen.findByRole("option", { name: "Ravenshold" }),
    ).toBeDefined();
    expect(screen.queryByRole("option", { name: "Amberhold" })).toBeNull();
  });
});
