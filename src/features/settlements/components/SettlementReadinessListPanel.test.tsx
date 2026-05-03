import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementReadinessListPanel } from "./SettlementReadinessListPanel";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("SettlementReadinessListPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("shows settlement readiness rows", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        settlementRows: [
          createSettlementRow({
            auto_ready_enabled: true,
            id: "settlement-1",
            name: "Amberhold",
          }),
          createSettlementRow({
            id: "settlement-2",
            is_ready_current_turn: true,
            name: "Briarwatch",
            ready_set_at: "2026-05-02T12:00:00.000Z",
          }),
          createSettlementRow({
            id: "settlement-3",
            name: "Cinderford",
          }),
        ],
      }),
    );

    renderSettlementReadinessListPanel();

    expect(
      await screen.findByRole("heading", {
        name: "Settlement readiness list",
      }),
    ).toBeDefined();
    expectSettlementRow("Amberhold", "Auto-ready", "Never");
    expectSettlementRow("Briarwatch", "Ready", "2026-05-02T12:00:00.000Z");
    expectSettlementRow("Cinderford", "Not ready", "Never");
  });

  it("shows an empty state", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ settlementRows: [] }));

    renderSettlementReadinessListPanel();

    expect(await screen.findByText("No settlements yet")).toBeDefined();
    expect(
      screen.getByText(
        "Settlement readiness appears here after settlements are created.",
      ),
    ).toBeDefined();
  });

  it("shows loading state before the list resolves", () => {
    requireSupabaseClient.mockReturnValue(createPendingClient());

    renderSettlementReadinessListPanel();

    expect(
      screen.getByText("Loading settlement readiness list..."),
    ).toBeDefined();
  });

  it("shows query errors", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        error: new Error("Readiness list unavailable."),
        settlementRows: [],
      }),
    );

    renderSettlementReadinessListPanel();

    expect(
      await screen.findByText("Settlement readiness list could not be loaded"),
    ).toBeDefined();
    expect(screen.getByText("Readiness list unavailable.")).toBeDefined();
  });
});

function renderSettlementReadinessListPanel(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementReadinessListPanel worldId="world-1" />
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

type TestSettlementReadinessListRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly name: string;
  readonly nation_id: string;
  readonly ready_set_at: string | null;
};

function createSettlementRow(
  overrides: Partial<TestSettlementReadinessListRow> = {},
): TestSettlementReadinessListRow {
  return {
    auto_ready_enabled: false,
    id: "settlement-1",
    is_ready_current_turn: false,
    name: "Settlement",
    nation_id: "nation-1",
    ready_set_at: null,
    ...overrides,
  };
}

function createClient({
  error = null,
  settlementRows,
}: {
  readonly error?: Error | null;
  readonly settlementRows: readonly TestSettlementReadinessListRow[];
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
        return createSettlementsQueryBuilder(
          new Promise<readonly TestSettlementReadinessListRow[]>(() => {
            // Keep the query pending for the loading-state assertion.
          }),
          null,
        );
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function createSettlementsQueryBuilder(
  rows:
    | readonly TestSettlementReadinessListRow[]
    | Promise<readonly TestSettlementReadinessListRow[]>,
  error: Error | null,
): unknown {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    returns: vi.fn(async () => ({
      data: await rows,
      error,
    })),
    select: vi.fn(() => builder),
  };

  return builder;
}

function expectSettlementRow(
  settlementName: string,
  state: string,
  lastReady: string,
): void {
  const nameCell = screen.getByText(settlementName);
  const row = nameCell.closest("tr");

  expect(row).not.toBeNull();
  expect(row).toHaveTextContent(state);
  expect(row).toHaveTextContent(lastReady);
}
