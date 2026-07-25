import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementStockpilesPanel } from "./SettlementStockpilesPanel";

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
    onClick,
  }: {
    readonly children: ReactNode;
    readonly to: string;
    readonly params?: Readonly<Record<string, string>>;
    readonly className?: string;
    readonly onClick?: () => void;
  }) => {
    const href =
      params === undefined
        ? to
        : Object.entries(params).reduce(
            (path, [name, value]) => path.replace(`$${name}`, value),
            to,
          );
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  },
}));

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn<(message: string) => void>(),
  toastSuccess:
    vi.fn<(message: string, options?: { description?: string }) => void>(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000001";
const FOOD_RESOURCE_ID = "00000000-0000-0000-0000-000000000002";
const WATER_RESOURCE_ID = "00000000-0000-0000-0000-000000000003";
const WORLD_ID = "00000000-0000-0000-0000-000000000010";
const NATION_ID = "00000000-0000-0000-0000-000000000020";

describe("SettlementStockpilesPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("renders stockpile rows for each resource", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({
            resource_name: "Food",
            quantity: 100,
            effective_cap: 500,
            is_system_resource: true,
          }),
          createStockpileRow({
            resource_id: WATER_RESOURCE_ID,
            resource_name: "Fresh Water",
            quantity: 250,
            effective_cap: 300,
            is_system_resource: true,
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("Fresh Water")).toBeDefined();
    expect(screen.getByText("100 / 500")).toBeDefined();
    expect(screen.getByText("250 / 300")).toBeDefined();
  });

  it("shows the detail placeholder until a resource is selected", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({ resource_name: "Food", quantity: 100 }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("Select a resource to view details")).toBeDefined();

    await user.click(screen.getByText("Food"));

    await waitFor(() => {
      expect(
        screen.queryByText("Select a resource to view details"),
      ).toBeNull();
    });
  });

  it("shows system badge for system resources", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({
            resource_name: "Food",
            is_system_resource: true,
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("system")).toBeDefined();
  });

  it("shows at-cap badge when quantity equals effective cap", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({
            resource_name: "Food",
            quantity: 500,
            effective_cap: 500,
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("at cap")).toBeDefined();
  });

  it("orders system resources before non-system resources", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({
            resource_id: WATER_RESOURCE_ID,
            resource_name: "Zirconium",
            is_system_resource: false,
            quantity: 10,
            effective_cap: 100,
          }),
          createStockpileRow({
            resource_name: "Food",
            is_system_resource: true,
            quantity: 50,
            effective_cap: 200,
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    const foodCell = screen.getByText("Food");
    const zirconiumCell = screen.getByText("Zirconium");
    expect(
      // Node.DOCUMENT_POSITION_FOLLOWING means zirconium comes after food
      foodCell.compareDocumentPosition(zirconiumCell) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the edit affordance from non-admin users (managers)", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({ resource_name: "Food", quantity: 100 }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(
      screen.queryByRole("button", { name: /Edit Food quantity/i }),
    ).toBeNull();
  });

  it("hides the edit affordance when the world is archived", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({ resource_name: "Food", quantity: 100 }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: true });

    await screen.findByText("Food");
    expect(
      screen.queryByRole("button", { name: /Edit Food quantity/i }),
    ).toBeNull();
  });

  it("opens the edit dialog when the admin clicks Edit", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({ resource_name: "Food", quantity: 100 }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Food");
    await user.click(
      screen.getByRole("button", { name: "Edit Food quantity" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Edit Food quantity" }),
    ).toBeDefined();
  });

  it("calls mutation with correct payload on successful edit", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          quantity: 200,
          resource_id: FOOD_RESOURCE_ID,
          settlement_id: SETTLEMENT_ID,
        },
        error: null,
      }),
    });
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({ resource_name: "Food", quantity: 100 }),
        ],
        rpcMock,
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Food");
    await user.click(
      screen.getByRole("button", { name: "Edit Food quantity" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Edit Food quantity",
    });
    const input = within(dialog).getByRole("textbox", { name: "Quantity" });
    await user.clear(input);
    await user.type(input, "200");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "set_settlement_stockpile_quantity",
        {
          p_quantity: 200,
          p_resource_id: FOOD_RESOURCE_ID,
          p_settlement_id: SETTLEMENT_ID,
        },
      );
    });

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledExactlyOnceWith(
        "Stockpile updated.",
        undefined,
      );
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows an inline error for a negative quantity", async () => {
    const user = userEvent.setup();
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({ resource_name: "Food", quantity: 100 }),
        ],
      }),
    );

    renderPanel({ canAdmin: true, isArchived: false });

    await screen.findByText("Food");
    await user.click(
      screen.getByRole("button", { name: "Edit Food quantity" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Edit Food quantity",
    });
    const input = within(dialog).getByRole("textbox", { name: "Quantity" });
    await user.clear(input);
    await user.type(input, "-5");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Quantity must be a non-negative decimal with up to four decimal places.",
      ),
    ).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows empty state when settlement has no stockpiles", async () => {
    requireSupabaseClient.mockReturnValue(createClient({ stockpileRows: [] }));

    renderPanel({ canAdmin: false, isArchived: false });

    expect(await screen.findByText("No stockpiles")).toBeDefined();
  });

  it("shows forecast column header", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [createStockpileRow({ resource_name: "Food" })],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("Forecast")).toBeDefined();
  });

  it("shows — when no forecast snapshot exists", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [createStockpileRow({ resource_name: "Food" })],
        forecastRow: null,
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("—")).toBeDefined();
  });

  it("shows positive net delta with + prefix for forecast", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [createStockpileRow({ resource_name: "Food" })],
        forecastRow: {
          id: "transition-1",
          forecast_snapshot_jsonb: {
            bySettlement: {
              [SETTLEMENT_ID]: createForecastSettlement(SETTLEMENT_ID, [
                createForecastResourceDelta({
                  resourceId: FOOD_RESOURCE_ID,
                  netDelta: 10,
                }),
              ]),
            },
          },
        },
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("+10")).toBeDefined();
  });

  it("shows negative net delta for forecast", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [createStockpileRow({ resource_name: "Food" })],
        forecastRow: {
          id: "transition-1",
          forecast_snapshot_jsonb: {
            bySettlement: {
              [SETTLEMENT_ID]: createForecastSettlement(SETTLEMENT_ID, [
                createForecastResourceDelta({
                  resourceId: FOOD_RESOURCE_ID,
                  netDelta: -20,
                }),
              ]),
            },
          },
        },
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    const forecastLink = screen.getByRole("link", { name: "-20" });
    expect(forecastLink.getAttribute("href")).toBe(
      `/worlds/${WORLD_ID}/nations/${NATION_ID}/settlements/${SETTLEMENT_ID}/forecast`,
    );
  });

  it("colors the capacity bar amber above 80% and red at cap", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({
            resource_name: "Food",
            quantity: 90,
            effective_cap: 100,
          }),
          createStockpileRow({
            resource_id: WATER_RESOURCE_ID,
            resource_name: "Fresh Water",
            quantity: 100,
            effective_cap: 100,
          }),
        ],
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    const bars = screen.getAllByRole("progressbar");
    expect(bars[0]?.firstElementChild?.className).toContain("bg-amber-500");
    expect(bars[1]?.firstElementChild?.className).toContain("bg-red-600");
  });

  it("shows — for resources not in forecast snapshot", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [
          createStockpileRow({ resource_name: "Food" }),
          createStockpileRow({
            resource_id: WATER_RESOURCE_ID,
            resource_name: "Fresh Water",
          }),
        ],
        forecastRow: {
          id: "transition-1",
          forecast_snapshot_jsonb: {
            bySettlement: {
              // only Food in forecast, not Water
              [SETTLEMENT_ID]: createForecastSettlement(SETTLEMENT_ID, [
                createForecastResourceDelta({
                  resourceId: FOOD_RESOURCE_ID,
                  netDelta: 5,
                }),
              ]),
            },
          },
        },
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByText("+5")).toBeDefined();
    expect(screen.getByText("—")).toBeDefined();
  });

  it("shows a loading indicator in the forecast column while the forecast is pending", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [createStockpileRow({ resource_name: "Food" })],
        forecastInvoke: vi.fn().mockReturnValue(new Promise(() => {})),
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(screen.getByLabelText("Loading forecast")).toBeDefined();
  });

  it("shows an error indicator in the forecast column when the forecast query fails", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        stockpileRows: [createStockpileRow({ resource_name: "Food" })],
        forecastInvoke: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error("server error") }),
      }),
    );

    renderPanel({ canAdmin: false, isArchived: false });

    await screen.findByText("Food");
    expect(await screen.findByLabelText("Forecast error")).toBeDefined();
  });
});

function renderPanel({
  canAdmin,
  isArchived,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SettlementStockpilesPanel
        canAdmin={canAdmin}
        isArchived={isArchived}
        nationId={NATION_ID}
        settlementId={SETTLEMENT_ID}
        worldId={WORLD_ID}
      />
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

type TestStockpileRow = {
  readonly effective_cap: number;
  readonly is_system_resource: boolean;
  readonly quantity: number;
  readonly resource_id: string;
  readonly resource_name: string;
  readonly settlement_id: string;
};

function createStockpileRow(
  overrides: Partial<TestStockpileRow> = {},
): TestStockpileRow {
  return {
    effective_cap: 500,
    is_system_resource: false,
    quantity: 0,
    resource_id: FOOD_RESOURCE_ID,
    resource_name: "Food",
    settlement_id: SETTLEMENT_ID,
    ...overrides,
  };
}

type TestResourceDelta = {
  readonly resourceId: string;
  readonly produced: number;
  readonly consumed: number;
  readonly tradeIn: number;
  readonly tradeOut: number;
  readonly netDelta: number;
  readonly quantityBefore: number;
  readonly quantityAfter: number;
};

function createForecastResourceDelta(
  overrides: Partial<TestResourceDelta> & { readonly resourceId: string },
): TestResourceDelta {
  return {
    produced: 0,
    consumed: 0,
    tradeIn: 0,
    tradeOut: 0,
    netDelta: 0,
    quantityBefore: 0,
    quantityAfter: 0,
    ...overrides,
  };
}

function createForecastSettlement(
  settlementId: string,
  resourceDeltas: readonly TestResourceDelta[],
): object {
  return {
    settlementId,
    resourceDeltas,
    deathsBy: { starvation: 0, homelessness: 0, other: 0 },
    completedProjects: [],
    buildingUpkeepFailures: [],
    tradeChanges: [],
  };
}

type TestForecastRow = {
  readonly id: string;
  readonly forecast_snapshot_jsonb: unknown;
};

function createClient({
  stockpileRows,
  forecastRow = null,
  forecastInvoke,
  rpcMock = vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}: {
  readonly stockpileRows: readonly TestStockpileRow[];
  readonly forecastRow?: TestForecastRow | null;
  readonly forecastInvoke?: ReturnType<typeof vi.fn>;
  readonly rpcMock?: ReturnType<typeof vi.fn>;
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly functions: { readonly invoke: ReturnType<typeof vi.fn> };
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const stockpilesSelectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => stockpilesSelectBuilder),
    order: vi.fn(() => stockpilesSelectBuilder),
    returns: vi.fn().mockResolvedValue({ data: stockpileRows, error: null }),
  };

  // The forecast now comes from the read-only preview of the end-turn-simulation
  // Edge Function, not a turn_transitions row.
  const forecastSnapshot =
    forecastRow === null ? null : forecastRow.forecast_snapshot_jsonb;

  const defaultInvoke = vi.fn().mockResolvedValue({
    data: { data: { forecastSnapshot }, ok: true },
    error: null,
  });

  return {
    from: vi.fn((table: string) => {
      if (table === "settlement_stockpiles_view") {
        return { select: vi.fn(() => stockpilesSelectBuilder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    functions: {
      invoke: forecastInvoke ?? defaultInvoke,
    },
    rpc: rpcMock,
  };
}
