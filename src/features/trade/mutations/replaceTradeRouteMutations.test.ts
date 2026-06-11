import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { tradeRoutesQueryKeys } from "../queries/tradeRoutesQueryKeys";

import {
  isReplaceTradeRouteMutationError,
  replaceTradeRouteMutationOptions,
} from "./replaceTradeRouteMutations";

const ORIGIN_ID = "11111111-1111-1111-1111-111111111111";
const DESTINATION_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const RESOURCE_ID = "44444444-4444-4444-4444-444444444444";
const OLD_ROUTE_ID = "55555555-5555-5555-5555-555555555555";
const NEW_ROUTE_ID = "66666666-6666-6666-6666-666666666666";

const VALID_INPUT = {
  newRoutePayload: {
    destinationSettlementId: DESTINATION_ID,
    legs: [
      { direction: "send" as const, quantity: 100, resourceId: RESOURCE_ID },
    ],
    originSettlementId: ORIGIN_ID,
  },
  oldRouteId: OLD_ROUTE_ID,
  proposingCitizenId: CITIZEN_ID,
};

type RpcRow = {
  readonly destination_settlement_id: string;
  readonly new_route_id: string;
  readonly old_route_id: string;
  readonly origin_settlement_id: string;
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

describe("replaceTradeRouteMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        oldRouteId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isReplaceTradeRouteMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects self-loop in newRoutePayload before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        newRoutePayload: {
          ...VALID_INPUT.newRoutePayload,
          destinationSettlementId: ORIGIN_ID,
        },
      }),
    ).rejects.toMatchObject({ code: "replace_trade_route_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls replace_trade_route RPC and returns expected result", async () => {
    const row: RpcRow = {
      destination_settlement_id: DESTINATION_ID,
      new_route_id: NEW_ROUTE_ID,
      old_route_id: OLD_ROUTE_ID,
      origin_settlement_id: ORIGIN_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      destinationSettlementId: DESTINATION_ID,
      newTradeRouteId: NEW_ROUTE_ID,
      oldTradeRouteId: OLD_ROUTE_ID,
      originSettlementId: ORIGIN_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("replace_trade_route", {
      p_new_payload: {
        destination_settlement_id: DESTINATION_ID,
        legs: [{ direction: "send", quantity: 100, resourceId: RESOURCE_ID }],
        origin_settlement_id: ORIGIN_ID,
      },
      p_old_id: OLD_ROUTE_ID,
      p_proposing_citizen_id: CITIZEN_ID,
    });
    expect(options.mutationKey).toEqual(["trade", "replace-trade-route"]);
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

  it("raises replace_trade_route_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "replace_trade_route_not_found" });
  });

  it("maps 42501 to replace_trade_route_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "replace_trade_route_not_authorized" });
  });

  it("maps P0002 to replace_trade_route_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "replace_trade_route_not_found" });
  });

  it("maps P0001 with 'current status' to replace_trade_route_invalid_status", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "cannot replace in current status" },
    });
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "replace_trade_route_invalid_status" });
  });

  it("maps P0001 with 'trashed' to replace_trade_route_resource_trashed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "resource is trashed" },
    });
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "replace_trade_route_resource_trashed" });
  });

  it("maps P0001 with 'endpoint nation' to replace_trade_route_citizen_wrong_nation", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "citizen not in endpoint nation" },
    });
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "replace_trade_route_citizen_wrong_nation",
    });
  });

  it("maps generic P0001 to replace_trade_route_values_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "some other error" },
    });
    const queryClient = createQueryClient();
    const options = replaceTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "replace_trade_route_values_invalid" });
  });
});
