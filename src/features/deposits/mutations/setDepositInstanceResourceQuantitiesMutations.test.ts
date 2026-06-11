import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { depositsQueryKeys } from "../queries/depositsQueryKeys";

import {
  isSetDepositInstanceResourceQuantitiesMutationError,
  setDepositInstanceResourceQuantitiesMutationOptions,
} from "./setDepositInstanceResourceQuantitiesMutations";

const DEPOSIT_INSTANCE_RESOURCE_ID = "11111111-1111-1111-1111-111111111111";
const DEPOSIT_INSTANCE_ID = "22222222-2222-2222-2222-222222222222";
const SETTLEMENT_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = {
  depositInstanceResourceId: DEPOSIT_INSTANCE_RESOURCE_ID,
  initialQuantity: 1000,
  remainingQuantity: 750,
  settlementId: SETTLEMENT_ID,
};

type RpcRow = {
  readonly deposit_instance_resource_id: string;
  readonly deposit_instance_id: string;
  readonly settlement_id: string;
  readonly initial_quantity: number;
  readonly remaining_quantity: number;
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

describe("setDepositInstanceResourceQuantitiesMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setDepositInstanceResourceQuantitiesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        depositInstanceResourceId: "not-a-uuid",
        initialQuantity: 100,
        remainingQuantity: 50,
        settlementId: SETTLEMENT_ID,
      }),
    ).rejects.toSatisfy(isSetDepositInstanceResourceQuantitiesMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls RPC with correct parameters and returns expected result", async () => {
    const row: RpcRow = {
      deposit_instance_resource_id: DEPOSIT_INSTANCE_RESOURCE_ID,
      deposit_instance_id: DEPOSIT_INSTANCE_ID,
      settlement_id: SETTLEMENT_ID,
      initial_quantity: 1000,
      remaining_quantity: 750,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = setDepositInstanceResourceQuantitiesMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      depositInstanceResourceId: DEPOSIT_INSTANCE_RESOURCE_ID,
      depositInstanceId: DEPOSIT_INSTANCE_ID,
      settlementId: SETTLEMENT_ID,
      initialQuantity: 1000,
      remainingQuantity: 750,
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      "set_deposit_instance_resource_quantities",
      {
        p_deposit_instance_resource_id: DEPOSIT_INSTANCE_RESOURCE_ID,
        p_initial_quantity: 1000,
        p_remaining_quantity: 750,
      },
    );
    expect(options.mutationKey).toEqual([
      "deposits",
      "set-deposit-instance-resource-quantities",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: depositsQueryKeys.instancesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("raises set_resource_quantities_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setDepositInstanceResourceQuantitiesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_resource_quantities_not_found" });
  });

  it("maps 42501 to set_resource_quantities_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setDepositInstanceResourceQuantitiesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_resource_quantities_not_authorized" });
  });

  it("maps P0002 to set_resource_quantities_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "not found" },
    });
    const queryClient = createQueryClient();
    const options = setDepositInstanceResourceQuantitiesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_resource_quantities_not_found" });
  });

  it("maps P0001 to set_resource_quantities_out_of_range", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "P0001",
        message: "remaining_quantity must be <= initial_quantity",
      },
    });
    const queryClient = createQueryClient();
    const options = setDepositInstanceResourceQuantitiesMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_resource_quantities_out_of_range" });
  });
});
