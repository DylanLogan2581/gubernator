import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProposeTradeRouteDialog } from "./ProposeTradeRouteDialog";

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
const DEST_SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const WORLD_ID = "00000000-0000-0000-0000-000000000003";
const ROUTE_ID = "00000000-0000-0000-0000-000000000010";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000030";
const CITIZEN_ID = "00000000-0000-0000-0000-000000000040";

const FAR_SETTLEMENT_ROW = {
  id: DEST_SETTLEMENT_ID,
  name: "Far Settlement",
  nation_id: "00000000-0000-0000-0000-000000000099",
  nations: { name: "Far Nation" },
};

const GRAIN_RESOURCE_ROW = {
  id: RESOURCE_ID,
  name: "Grain",
  slug: "grain",
  world_id: WORLD_ID,
  is_trashed: false,
  is_system_resource: false,
  base_stockpile_cap: 100,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

function createClient({
  settlementRows = [] as readonly unknown[],
  resourceRows = [] as readonly unknown[],
  rpcMock = vi.fn(),
}: {
  readonly settlementRows?: readonly unknown[];
  readonly resourceRows?: readonly unknown[];
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): unknown {
  const settlementsBuilder: Record<string, unknown> = {
    eq: vi.fn(() => settlementsBuilder),
    order: vi.fn(() => settlementsBuilder),
    returns: vi.fn().mockResolvedValue({ data: settlementRows, error: null }),
  };
  const resourcesBuilder: Record<string, unknown> = {
    eq: vi.fn(() => resourcesBuilder),
    order: vi.fn(() => resourcesBuilder),
    returns: vi.fn().mockResolvedValue({ data: resourceRows, error: null }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "settlements")
        return { select: vi.fn(() => settlementsBuilder) };
      if (table === "resources")
        return { select: vi.fn(() => resourcesBuilder) };
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: rpcMock,
  };
}

function renderDialog({
  onClose = vi.fn<() => void>(),
  client = createClient(),
}: {
  readonly onClose?: () => void;
  readonly client?: unknown;
} = {}): { readonly onClose: () => void } {
  requireSupabaseClient.mockReturnValue(client);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ProposeTradeRouteDialog
        activeCharacterId={CITIZEN_ID}
        onClose={onClose}
        queryClient={queryClient}
        settlementId={SETTLEMENT_ID}
        worldId={WORLD_ID}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("ProposeTradeRouteDialog", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("renders the propose dialog", () => {
    renderDialog();
    expect(
      screen.getByRole("dialog", { name: "Propose trade route" }),
    ).toBeDefined();
  });

  it("happy path — submits and shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "propose_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    const { onClose } = renderDialog({
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        rpcMock,
      }),
    });

    const dialog = screen.getByRole("dialog", { name: "Propose trade route" });
    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    const resourceSelect = await within(dialog).findByRole("combobox", {
      name: "Leg 1 resource",
    });
    await user.selectOptions(resourceSelect, RESOURCE_ID);

    const qtyInput = within(dialog).getByRole("textbox", {
      name: "Leg 1 quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "25");

    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route proposed.",
        undefined,
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("validation — shows errors when fields are empty", async () => {
    const user = userEvent.setup();
    renderDialog({
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    expect(screen.getByText("Select a destination settlement.")).toBeDefined();
    expect(screen.getByText("Select a resource.")).toBeDefined();
    expect(
      screen.getByText("Quantity must be greater than zero."),
    ).toBeDefined();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("error branch — shows error toast on RPC failure", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "propose_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "permission denied" },
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    renderDialog({
      client: createClient({
        settlementRows: [FAR_SETTLEMENT_ROW],
        resourceRows: [GRAIN_RESOURCE_ROW],
        rpcMock,
      }),
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Propose trade route",
    });
    const destSelect = await within(dialog).findByRole("combobox", {
      name: "Destination settlement",
    });
    await user.selectOptions(destSelect, DEST_SETTLEMENT_ID);

    const resourceSelect = await within(dialog).findByRole("combobox", {
      name: "Leg 1 resource",
    });
    await user.selectOptions(resourceSelect, RESOURCE_ID);

    const qtyInput = within(dialog).getByRole("textbox", {
      name: "Leg 1 quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "10");

    await user.click(within(dialog).getByRole("button", { name: "Propose" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
