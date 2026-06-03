import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { resourcesQueryKeys } from "../queries/resourcesQueryKeys";

import {
  isStockpileMutationError,
  updateSettlementStockpileMutationOptions,
} from "./settlementStockpilesMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const RESOURCE_ID = "22222222-2222-2222-2222-222222222222";

const VALID_INPUT = {
  quantity: "50.25",
  resourceId: RESOURCE_ID,
  settlementId: SETTLEMENT_ID,
};

type RpcRow = {
  readonly quantity: number;
  readonly resource_id: string;
  readonly settlement_id: string;
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

describe("updateSettlementStockpileMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        quantity: "not-a-number",
      }),
    ).rejects.toSatisfy(isStockpileMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects quantity with more than four decimal places before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        quantity: "1.12345",
      }),
    ).rejects.toMatchObject({ code: "stockpile_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls set_settlement_stockpile_quantity RPC and returns expected result", async () => {
    const row: RpcRow = {
      quantity: 50.25,
      resource_id: RESOURCE_ID,
      settlement_id: SETTLEMENT_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      quantity: 50.25,
      resourceId: RESOURCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      "set_settlement_stockpile_quantity",
      {
        p_quantity: 50.25,
        p_resource_id: RESOURCE_ID,
        p_settlement_id: SETTLEMENT_ID,
      },
    );
    expect(options.mutationKey).toEqual([
      "resources",
      "set-settlement-stockpile-quantity",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: resourcesQueryKeys.stockpilesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("accepts zero quantity (clearing the stockpile)", async () => {
    const row: RpcRow = {
      quantity: 0,
      resource_id: RESOURCE_ID,
      settlement_id: SETTLEMENT_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      ...VALID_INPUT,
      quantity: "0",
    });

    expect(calls.rpc).toHaveBeenCalledWith(
      "set_settlement_stockpile_quantity",
      expect.objectContaining({ p_quantity: 0 }),
    );
  });

  it("raises stockpile_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "stockpile_not_found" });
  });

  it("maps 42501 to stockpile_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "stockpile_not_authorized" });
  });

  it("maps P0001 to stockpile_resource_trashed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "resource is soft-deleted" },
    });
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "stockpile_resource_trashed" });
  });

  it("maps P0002 to stockpile_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "settlement or resource not found" },
    });
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "stockpile_not_found" });
  });
});

describe("isStockpileMutationError", () => {
  it("identifies StockpileMutationError instances correctly", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateSettlementStockpileMutationOptions({
      client,
      queryClient,
    });

    const err = await executeMutation(queryClient, options, {
      ...VALID_INPUT,
      resourceId: "bad",
    }).catch((e: unknown) => e);

    expect(isStockpileMutationError(err)).toBe(true);
    expect(isStockpileMutationError(new Error("other"))).toBe(false);
  });
});
