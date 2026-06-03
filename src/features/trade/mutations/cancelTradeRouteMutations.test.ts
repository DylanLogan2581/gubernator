import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { tradeRoutesQueryKeys } from "../queries/tradeRoutesQueryKeys";

import {
  cancelTradeRouteMutationOptions,
  isCancelTradeRouteMutationError,
} from "./cancelTradeRouteMutations";

const ORIGIN_ID = "11111111-1111-1111-1111-111111111111";
const DESTINATION_ID = "22222222-2222-2222-2222-222222222222";
const TRADE_ROUTE_ID = "55555555-5555-5555-5555-555555555555";

const VALID_INPUT = { tradeRouteId: TRADE_ROUTE_ID };

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

describe("cancelTradeRouteMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = cancelTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { tradeRouteId: "not-a-uuid" }),
    ).rejects.toSatisfy(isCancelTradeRouteMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls cancel_trade_route RPC and returns expected result", async () => {
    const row: RpcRow = {
      destination_settlement_id: DESTINATION_ID,
      id: TRADE_ROUTE_ID,
      origin_settlement_id: ORIGIN_ID,
      status: "cancelled",
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = cancelTradeRouteMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      destinationSettlementId: DESTINATION_ID,
      originSettlementId: ORIGIN_ID,
      status: "cancelled",
      tradeRouteId: TRADE_ROUTE_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("cancel_trade_route", {
      p_route_id: TRADE_ROUTE_ID,
    });
    expect(options.mutationKey).toEqual(["trade", "cancel-trade-route"]);
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

  it("raises cancel_trade_route_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = cancelTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "cancel_trade_route_not_found" });
  });

  it("maps 42501 to cancel_trade_route_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = cancelTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "cancel_trade_route_not_authorized" });
  });

  it("maps P0002 to cancel_trade_route_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = cancelTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "cancel_trade_route_not_found" });
  });

  it("maps P0001 with 'current status' to cancel_trade_route_invalid_status", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "cannot cancel in current status" },
    });
    const queryClient = createQueryClient();
    const options = cancelTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "cancel_trade_route_invalid_status" });
  });

  it("maps generic P0001 to cancel_trade_route_values_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "some other error" },
    });
    const queryClient = createQueryClient();
    const options = cancelTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "cancel_trade_route_values_invalid" });
  });
});
