import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { tradeRoutesQueryKeys } from "../queries/tradeRoutesQueryKeys";

import {
  isProposeTradeRouteMutationError,
  proposeTradeRouteMutationOptions,
} from "./proposeTradeRouteMutations";

const ORIGIN_ID = "11111111-1111-1111-1111-111111111111";
const DESTINATION_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const RESOURCE_ID = "44444444-4444-4444-4444-444444444444";
const TRADE_ROUTE_ID = "55555555-5555-5555-5555-555555555555";

const VALID_INPUT = {
  destinationSettlementId: DESTINATION_ID,
  originSettlementId: ORIGIN_ID,
  proposingCitizenId: CITIZEN_ID,
  quantityPerTransition: 50,
  resourceId: RESOURCE_ID,
};

type RpcRow = {
  readonly destination_settlement_id: string;
  readonly id: string;
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

describe("proposeTradeRouteMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        originSettlementId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isProposeTradeRouteMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects self-loop (origin === destination) before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        destinationSettlementId: ORIGIN_ID,
      }),
    ).rejects.toMatchObject({ code: "propose_trade_route_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls propose_trade_route RPC and returns expected result", async () => {
    const row: RpcRow = {
      destination_settlement_id: DESTINATION_ID,
      id: TRADE_ROUTE_ID,
      origin_settlement_id: ORIGIN_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      destinationSettlementId: DESTINATION_ID,
      originSettlementId: ORIGIN_ID,
      tradeRouteId: TRADE_ROUTE_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("propose_trade_route", {
      p_destination: DESTINATION_ID,
      p_origin: ORIGIN_ID,
      p_proposed_by_citizen_id: CITIZEN_ID,
      p_quantity: 50,
      p_resource_id: RESOURCE_ID,
    });
    expect(options.mutationKey).toEqual(["trade", "propose-trade-route"]);
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

  it("raises propose_trade_route_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "propose_trade_route_not_found" });
  });

  it("maps 42501 to propose_trade_route_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "propose_trade_route_not_authorized" });
  });

  it("maps P0002 to propose_trade_route_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "propose_trade_route_not_found" });
  });

  it("maps P0001 with 'trashed' to propose_trade_route_resource_trashed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "resource is trashed" },
    });
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "propose_trade_route_resource_trashed" });
  });

  it("maps P0001 with 'endpoint nation' to propose_trade_route_citizen_wrong_nation", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "citizen not in endpoint nation" },
    });
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "propose_trade_route_citizen_wrong_nation",
    });
  });

  it("maps generic P0001 to propose_trade_route_values_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "some other business error" },
    });
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "propose_trade_route_values_invalid" });
  });

  it("normalizes unknown Supabase errors via AuthUiError", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe("isProposeTradeRouteMutationError", () => {
  it("identifies ProposeTradeRouteMutationError instances correctly", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = proposeTradeRouteMutationOptions({ client, queryClient });

    const err = await executeMutation(queryClient, options, {
      ...VALID_INPUT,
      proposingCitizenId: "bad",
    }).catch((e: unknown) => e);

    expect(isProposeTradeRouteMutationError(err)).toBe(true);
    expect(isProposeTradeRouteMutationError(new Error("other"))).toBe(false);
  });
});
