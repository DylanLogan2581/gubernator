import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RejectConfirmDialog } from "./RejectConfirmDialog";

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
    legs: [
      {
        id: "00000000-0000-0000-0000-000000000031",
        direction: "send" as const,
        quantityPerTransition: 10,
        resourceId: "00000000-0000-0000-0000-000000000030",
        resourceName: "Grain",
      },
    ],
    status: "proposed",
    originApprovalStatus: "pending",
    destinationApprovalStatus: "pending",
    replacementForTradeRouteId: null,
    pauseReasonLastTransition: null,
    proposedByCitizenId: CITIZEN_ID,
    originApprovedByCitizenId: null,
    destinationApprovedByCitizenId: null,
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
      <RejectConfirmDialog
        counterpart="Far Settlement (Far Nation)"
        onClose={onClose}
        queryClient={queryClient}
        rejectorCitizenId={CITIZEN_ID}
        route={makeRoute()}
        side="origin"
      />
    </QueryClientProvider>,
  );
  return { onClose, rpcMock };
}

describe("RejectConfirmDialog", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("shows reject dialog with counterpart name", () => {
    renderDialog();
    expect(
      screen.getByRole("dialog", { name: "Reject trade route?" }),
    ).toBeDefined();
    expect(screen.getByText(/Far Settlement \(Far Nation\)/)).toBeDefined();
  });

  it("happy path — calls RPC and shows success toast", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "reject_trade_route_side") {
        return {
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: ROUTE_ID,
              origin_settlement_id: SETTLEMENT_ID,
              destination_settlement_id: DEST_SETTLEMENT_ID,
              status: "cancelled",
            },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });
    const { onClose } = renderDialog({ rpcMock });

    await user.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        "Trade route rejected.",
        undefined,
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("error branch — shows error toast on RPC failure", async () => {
    const user = userEvent.setup();
    const rpcMock = vi.fn((fn: string) => {
      if (fn === "reject_trade_route_side") {
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

    await user.click(screen.getByRole("button", { name: "Reject" }));

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
