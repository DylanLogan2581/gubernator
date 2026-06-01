import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettlementStockpilesPanel } from "./SettlementStockpilesPanel";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
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
    expect(screen.getByText("100")).toBeDefined();
    expect(screen.getByText("250")).toBeDefined();
    expect(screen.getByText("500")).toBeDefined();
    expect(screen.getByText("300")).toBeDefined();
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
    expect(screen.getByText("read-only")).toBeDefined();
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
    expect(screen.getByText("read-only")).toBeDefined();
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
        settlementId={SETTLEMENT_ID}
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

function createClient({
  stockpileRows,
  rpcMock = vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}: {
  readonly stockpileRows: readonly TestStockpileRow[];
  readonly rpcMock?: ReturnType<typeof vi.fn>;
}): {
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const selectBuilder: Record<string, unknown> = {
    eq: vi.fn(() => selectBuilder),
    order: vi.fn(() => selectBuilder),
    returns: vi.fn().mockResolvedValue({ data: stockpileRows, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "settlement_stockpiles_view") {
        return { select: vi.fn(() => selectBuilder) };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock,
  };
}
