import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementReadinessSummaryPanel } from "./SettlementReadinessSummaryPanel";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("SettlementReadinessSummaryPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows an empty-world readiness summary", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ settlementRows: [] }));

    renderSettlementReadinessSummaryPanel();

    expect(
      await screen.findByRole("heading", { name: "Settlement readiness" }),
    ).toBeDefined();
    expect(
      screen.getByText("No settlements exist in this world yet."),
    ).toBeDefined();
    expectMetric("Total settlements", "0");
    expectMetric("Ready", "0");
    expectMetric("Not ready", "0");
  });

  it("counts all ready settlements", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        settlementRows: [
          createSettlementRow({ is_ready_current_turn: true }),
          createSettlementRow({
            auto_ready_enabled: true,
            is_ready_current_turn: false,
          }),
        ],
      }),
    );

    renderSettlementReadinessSummaryPanel();

    expect(await screen.findByText("Total settlements")).toBeDefined();
    expectMetric("Total settlements", "2");
    expectMetric("Ready", "2");
    expectMetric("Not ready", "0");
    expect(
      screen.getByText(
        "Auto-ready settlements count as ready for the current turn.",
      ),
    ).toBeDefined();
  });

  it("counts mixed manual, auto-ready, and not-ready settlements", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        settlementRows: [
          createSettlementRow({ auto_ready_enabled: true }),
          createSettlementRow({ is_ready_current_turn: true }),
          createSettlementRow(),
        ],
      }),
    );

    renderSettlementReadinessSummaryPanel();

    expect(await screen.findByText("Total settlements")).toBeDefined();
    expectMetric("Total settlements", "3");
    expectMetric("Ready", "2");
    expectMetric("Not ready", "1");
  });

  it("counts none-ready settlements", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        settlementRows: [createSettlementRow(), createSettlementRow()],
      }),
    );

    renderSettlementReadinessSummaryPanel();

    expect(await screen.findByText("Total settlements")).toBeDefined();
    expectMetric("Total settlements", "2");
    expectMetric("Ready", "0");
    expectMetric("Not ready", "2");
  });

  it("shows loading state before the summary resolves", () => {
    requireSupabaseClient.mockReturnValue(createPendingClient());

    renderSettlementReadinessSummaryPanel();

    expect(screen.getByText("Loading settlement readiness...")).toBeDefined();
  });

  it("shows query errors", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        error: new Error("Readiness unavailable."),
        settlementRows: [],
      }),
    );

    renderSettlementReadinessSummaryPanel();

    expect(
      await screen.findByText("Settlement readiness could not be loaded"),
    ).toBeDefined();
    expect(screen.getByText("Readiness unavailable.")).toBeDefined();
  });
});

function renderSettlementReadinessSummaryPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementReadinessSummaryPanel worldId="world-1" />
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

type TestSettlementReadinessSummaryRow = {
  readonly auto_ready_enabled: boolean;
  readonly is_ready_current_turn: boolean;
};

function createSettlementRow(
  overrides: Partial<TestSettlementReadinessSummaryRow> = {},
): TestSettlementReadinessSummaryRow {
  return {
    auto_ready_enabled: false,
    is_ready_current_turn: false,
    ...overrides,
  };
}

function createClient({
  error = null,
  settlementRows,
}: {
  readonly error?: Error | null;
  readonly settlementRows: readonly TestSettlementReadinessSummaryRow[];
}): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "settlements") {
        return createSettlementsQueryBuilder(settlementRows, error);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createPendingClient(): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "settlements") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              returns: vi.fn(
                () =>
                  new Promise<{
                    readonly data: readonly TestSettlementReadinessSummaryRow[];
                    readonly error: Error | null;
                  }>(() => {
                    // Keep the query pending for the loading-state assertion.
                  }),
              ),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createSettlementsQueryBuilder(
  rows: readonly TestSettlementReadinessSummaryRow[],
  error: Error | null,
): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        returns: vi.fn().mockResolvedValue({ data: rows, error }),
      })),
    })),
  };
}

function expectMetric(label: string, value: string): void {
  const term = screen.getByText(label);
  const group = term.closest("div");

  expect(group).not.toBeNull();
  expect(group).toHaveTextContent(value);
}
