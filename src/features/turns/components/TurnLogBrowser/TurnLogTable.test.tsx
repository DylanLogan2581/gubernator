import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TurnLogTable } from "./TurnLogTable";

import type { TurnLogBrowserEntry } from "../../queries/turnLogBrowserQueries";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
  }: {
    readonly children: ReactNode;
    readonly to: string;
  }) => <a href={to}>{children}</a>,
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient: () => ({}) as never,
}));

function makeEntry(
  overrides: Partial<TurnLogBrowserEntry> & { readonly id: string },
): TurnLogBrowserEntry {
  return {
    citizenId: null,
    citizenName: null,
    fromTurnNumber: 9,
    logCategory: "citizen.born",
    nationId: null,
    nationName: null,
    payloadJsonb: {},
    resourceId: null,
    settlementId: "settlement-1",
    settlementName: "Northwatch",
    settlementNationId: "nation-1",
    toTurnNumber: 10,
    turnTransitionId: "transition-1",
    worldId: "world-1",
    ...overrides,
  };
}

function renderTable(
  entries: readonly TurnLogBrowserEntry[],
): ReturnType<typeof render> {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <TurnLogTable
        entries={entries}
        isAdmin={false}
        isFetching={false}
        onPageChange={() => {}}
        page={0}
        totalCount={entries.length}
        worldId="world-1"
      />
    </QueryClientProvider>,
  );
}

describe("TurnLogTable", () => {
  it("does not render an expand chevron for a non-expandable row", () => {
    renderTable([makeEntry({ id: "entry-1", logCategory: "citizen.born" })]);

    const rows = screen.getAllByRole("row");
    // header row + one data row
    expect(rows).toHaveLength(2);
    expect(rows[1]?.getAttribute("aria-expanded")).toBeNull();
  });

  it("renders an expand chevron and reveals extra detail for an expandable row", async () => {
    const user = userEvent.setup();
    renderTable([
      makeEntry({
        id: "entry-1",
        logCategory: "building.suspended",
        payloadJsonb: {
          blueprintId: "bp-1",
          buildingId: "building-1",
          missedUpkeepCount: 3,
        },
      }),
    ]);

    const dataRow = screen.getAllByRole("row")[1];
    expect(dataRow?.getAttribute("aria-expanded")).toBe("false");

    await user.click(dataRow);

    expect(screen.getByText(/Unknown blueprint/)).toBeDefined();
  });

  it("keeps expansion state keyed by entry id, not row position, across an entries change", async () => {
    const user = userEvent.setup();
    const entryA = makeEntry({
      id: "entry-a",
      logCategory: "building.suspended",
      payloadJsonb: {
        blueprintId: "bp-1",
        buildingId: "building-a",
        missedUpkeepCount: 1,
      },
    });
    const entryB = makeEntry({
      id: "entry-b",
      logCategory: "building.suspended",
      payloadJsonb: {
        blueprintId: "bp-2",
        buildingId: "building-b",
        missedUpkeepCount: 2,
      },
    });

    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <TurnLogTable
          entries={[entryA, entryB]}
          isAdmin={false}
          isFetching={false}
          onPageChange={() => {}}
          page={0}
          totalCount={2}
          worldId="world-1"
        />
      </QueryClientProvider>,
    );

    // Expand the row for entryA, which is at position 0.
    await user.click(screen.getAllByRole("row")[1]);
    expect(screen.getAllByRole("row")[1]?.getAttribute("aria-expanded")).toBe(
      "true",
    );

    // Simulate paging: entryB now occupies position 0, entryA is gone.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TurnLogTable
          entries={[entryB]}
          isAdmin={false}
          isFetching={false}
          onPageChange={() => {}}
          page={1}
          totalCount={2}
          worldId="world-1"
        />
      </QueryClientProvider>,
    );

    // entryB was never expanded itself — a position-keyed bug would show it
    // expanded here since it now sits at row index 0.
    expect(screen.getAllByRole("row")[1]?.getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("aggregates standard_job.processed rows into one summary row per settlement", () => {
    renderTable([
      makeEntry({
        id: "job-1",
        logCategory: "standard_job.processed",
        payloadJsonb: {
          inputsConsumed: {},
          jobId: "job-woodcutter",
          outputsProduced: {},
          scale: 1,
          settlementId: "settlement-1",
          workerCount: 2,
        },
      }),
      makeEntry({
        id: "job-2",
        logCategory: "standard_job.processed",
        payloadJsonb: {
          inputsConsumed: {},
          jobId: "job-farmer",
          outputsProduced: {},
          scale: 1,
          settlementId: "settlement-1",
          workerCount: 1,
        },
      }),
    ]);

    expect(screen.getByText(/jobs processed/)).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    // Only the aggregated row, not two raw job rows.
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});
