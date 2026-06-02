import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReplaceTradeRouteDialog } from "./ReplaceTradeRouteDialog";

import type { TradeRoute } from "../../types/tradeRouteTypes";

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

const ROUTE_ID = "00000000-0000-0000-0000-000000000010";
const ROUTE_ID_2 = "00000000-0000-0000-0000-000000000011";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000001";
const DEST_SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const CITIZEN_ID = "00000000-0000-0000-0000-000000000040";

function makeRoute(): TradeRoute {
  return {
    id: ROUTE_ID,
    originSettlementId: SETTLEMENT_ID,
    originSettlementName: "Home Settlement",
    originNationName: "Home Nation",
    destinationSettlementId: DEST_SETTLEMENT_ID,
    destinationSettlementName: "Far Settlement",
    destinationNationName: "Far Nation",
    resourceId: "00000000-0000-0000-0000-000000000030",
    resourceName: "Grain",
    quantityPerTransition: 10,
    status: "active",
    originApprovalStatus: "approved",
    destinationApprovalStatus: "approved",
    replacementForTradeRouteId: null,
    pauseReasonLastTransition: null,
    proposedByCitizenId: CITIZEN_ID,
    originApprovedByCitizenId: CITIZEN_ID,
    destinationApprovedByCitizenId: CITIZEN_ID,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function renderDialog({
  onClose = vi.fn<() => void>(),
  rpcMock = vi.fn(),
}: {
  readonly onClose?: () => void;
  readonly rpcMock?: ReturnType<typeof vi.fn>;
} = {}): {
  readonly onClose: () => void;
  readonly rpcMock: ReturnType<typeof vi.fn>;
} {
  requireSupabaseClient.mockReturnValue({ rpc: rpcMock });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ReplaceTradeRouteDialog
        activeCharacterId={CITIZEN_ID}
        counterpart="Far Settlement (Far Nation)"
        onClose={onClose}
        queryClient={queryClient}
        route={makeRoute()}
      />
    </QueryClientProvider>,
  );
  return { onClose, rpcMock };
}

describe("ReplaceTradeRouteDialog", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("renders replace dialog with counterpart and resource", () => {
    renderDialog();
    expect(
      screen.getByRole("dialog", { name: "Replace trade route" }),
    ).toBeDefined();
    expect(screen.getByText(/Far Settlement \(Far Nation\)/)).toBeDefined();
    expect(screen.getByText("Grain")).toBeDefined();
  });

  it("happy path — submits new quantity and shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "replace_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              old_route_id: ROUTE_ID,
              new_route_id: ROUTE_ID_2,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    const { onClose } = renderDialog({ rpcMock });

    const dialog = screen.getByRole("dialog", { name: "Replace trade route" });
    const qtyInput = within(dialog).getByRole("textbox", {
      name: "New quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "20");

    await user.click(within(dialog).getByRole("button", { name: "Replace" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route replaced. New proposal pending approval.",
        undefined,
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("validation — rejects zero quantity", async () => {
    const user = userEvent.setup();
    const { rpcMock } = renderDialog();

    const dialog = screen.getByRole("dialog", { name: "Replace trade route" });
    const qtyInput = within(dialog).getByRole("textbox", {
      name: "New quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "0");

    await user.click(within(dialog).getByRole("button", { name: "Replace" }));

    expect(
      screen.getByText("Quantity must be greater than zero."),
    ).toBeDefined();
    expect(rpcMock).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("error branch — shows error toast on RPC failure", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "replace_trade_route") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "permission denied" },
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    renderDialog({ rpcMock });

    const dialog = screen.getByRole("dialog", { name: "Replace trade route" });
    const qtyInput = within(dialog).getByRole("textbox", {
      name: "New quantity per turn",
    });
    await user.clear(qtyInput);
    await user.type(qtyInput, "15");

    await user.click(within(dialog).getByRole("button", { name: "Replace" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("cancel button calls onClose without submitting", async () => {
    const user = userEvent.setup();
    const { onClose, rpcMock } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
