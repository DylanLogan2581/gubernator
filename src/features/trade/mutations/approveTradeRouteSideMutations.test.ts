import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { tradeRoutesQueryKeys } from "../queries/tradeRoutesQueryKeys";

import {
  approveTradeRouteSideMutationOptions,
  isApproveTradeRouteSideMutationError,
} from "./approveTradeRouteSideMutations";

const ORIGIN_ID = "11111111-1111-1111-1111-111111111111";
const DESTINATION_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const TRADE_ROUTE_ID = "55555555-5555-5555-5555-555555555555";

const VALID_INPUT = {
  approverCitizenId: CITIZEN_ID,
  side: "origin" as const,
  tradeRouteId: TRADE_ROUTE_ID,
};

type RpcRow = {
  readonly destination_settlement_id: string;
  readonly id: string;
  readonly origin_settlement_id: string;
  readonly status: string;
};

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<T> =
  | { readonly data: T; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createRpcClient(result: SupabaseResult<RpcRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: { readonly rpc: ReturnType<typeof vi.fn> };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return {
    client: { rpc } as unknown as GubernatorSupabaseClient,
    calls: { rpc },
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

function executeMutation<TOptions extends { mutationFn?: unknown }>(
  queryClient: QueryClient,
  options: TOptions,
  variables: unknown,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options as never)
    .execute(variables);
}

describe("approveTradeRouteSideMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        side: "invalid",
      }),
    ).rejects.toSatisfy(isApproveTradeRouteSideMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls approve_trade_route_side RPC and returns expected result", async () => {
    const row: RpcRow = {
      destination_settlement_id: DESTINATION_ID,
      id: TRADE_ROUTE_ID,
      origin_settlement_id: ORIGIN_ID,
      status: "proposed",
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      destinationSettlementId: DESTINATION_ID,
      originSettlementId: ORIGIN_ID,
      status: "proposed",
      tradeRouteId: TRADE_ROUTE_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("approve_trade_route_side", {
      p_approver_citizen_id: CITIZEN_ID,
      p_route_id: TRADE_ROUTE_ID,
      p_side: "origin",
    });
    expect(options.mutationKey).toEqual(["trade", "approve-trade-route-side"]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: tradeRoutesQueryKeys.forSettlement(ORIGIN_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: tradeRoutesQueryKeys.forSettlement(DESTINATION_ID),
      }),
    );
  });

  it("raises approve_trade_route_side_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "approve_trade_route_side_not_found" });
  });

  it("maps 42501 to approve_trade_route_side_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "approve_trade_route_side_not_authorized",
    });
  });

  it("maps P0002 to approve_trade_route_side_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "approve_trade_route_side_not_found" });
  });

  it("maps P0001 with 'already approved' to approve_trade_route_side_already_approved", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "side is already approved" },
    });
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "approve_trade_route_side_already_approved",
    });
  });

  it("maps P0001 with 'side nation' to approve_trade_route_side_citizen_wrong_nation", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "citizen not in side nation" },
    });
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "approve_trade_route_side_citizen_wrong_nation",
    });
  });

  it("maps P0001 with 'current status' to approve_trade_route_side_invalid_status", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "cannot approve in current status" },
    });
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "approve_trade_route_side_invalid_status",
    });
  });

  it("maps generic P0001 to approve_trade_route_side_values_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "some other error" },
    });
    const queryClient = createQueryClient();
    const options = approveTradeRouteSideMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "approve_trade_route_side_values_invalid",
    });
  });
});
