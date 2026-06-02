import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";

import {
  isSetConfiguredCullQuantityMutationError,
  setConfiguredCullQuantityMutationOptions,
} from "./setConfiguredCullQuantityMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const INSTANCE_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = {
  managedPopulationInstanceId: INSTANCE_ID,
  quantity: 5,
};

type RpcRow = { readonly id: string; readonly settlement_id: string };

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

describe("setConfiguredCullQuantityMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        managedPopulationInstanceId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isSetConfiguredCullQuantityMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects negative quantity before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, { ...VALID_INPUT, quantity: -1 }),
    ).rejects.toMatchObject({
      code: "set_configured_cull_quantity_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls set_configured_cull_quantity RPC and returns expected result", async () => {
    const row: RpcRow = { id: INSTANCE_ID, settlement_id: SETTLEMENT_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      managedPopulationInstanceId: INSTANCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("set_configured_cull_quantity", {
      p_instance_id: INSTANCE_ID,
      p_quantity: 5,
    });
    expect(options.mutationKey).toEqual([
      "managed-populations",
      "set-configured-cull-quantity",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          managedPopulationsQueryKeys.instancesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("accepts zero quantity (disables culling)", async () => {
    const row: RpcRow = { id: INSTANCE_ID, settlement_id: SETTLEMENT_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      ...VALID_INPUT,
      quantity: 0,
    });

    expect(calls.rpc).toHaveBeenCalledWith(
      "set_configured_cull_quantity",
      expect.objectContaining({ p_quantity: 0 }),
    );
  });

  it("raises set_configured_cull_quantity_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_configured_cull_quantity_not_found" });
  });

  it("maps 42501 to set_configured_cull_quantity_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "set_configured_cull_quantity_not_authorized",
    });
  });

  it("maps P0002 to set_configured_cull_quantity_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_configured_cull_quantity_not_found" });
  });

  it("maps P0001 to set_configured_cull_quantity_values_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "quantity exceeds population" },
    });
    const queryClient = createQueryClient();
    const options = setConfiguredCullQuantityMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "set_configured_cull_quantity_values_invalid",
    });
  });
});
