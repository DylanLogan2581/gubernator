import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { depositsQueryKeys } from "../queries/depositsQueryKeys";

import {
  createDepositInstanceMutationOptions,
  isCreateDepositInstanceMutationError,
} from "./createDepositInstanceMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const DEPOSIT_TYPE_ID = "22222222-2222-2222-2222-222222222222";
const DEPOSIT_INSTANCE_ID = "33333333-3333-3333-3333-333333333333";
const RESOURCE_ID = "44444444-4444-4444-4444-444444444444";

const VALID_INPUT = {
  depositTypeId: DEPOSIT_TYPE_ID,
  name: "Iron Deposit Alpha",
  resources: [{ initialQuantity: 100, resourceId: RESOURCE_ID }],
  settlementId: SETTLEMENT_ID,
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

describe("createDepositInstanceMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, { ...VALID_INPUT, name: "" }),
    ).rejects.toSatisfy(isCreateDepositInstanceMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects empty resources array before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, { ...VALID_INPUT, resources: [] }),
    ).rejects.toMatchObject({ code: "deposit_instance_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls create_deposit_instance RPC and returns expected result", async () => {
    const row: RpcRow = {
      id: DEPOSIT_INSTANCE_ID,
      settlement_id: SETTLEMENT_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      depositInstanceId: DEPOSIT_INSTANCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      "create_deposit_instance",
      expect.objectContaining({
        p_deposit_type_id: DEPOSIT_TYPE_ID,
        p_name: "Iron Deposit Alpha",
        p_settlement_id: SETTLEMENT_ID,
      }),
    );
    expect(options.mutationKey).toEqual([
      "deposits",
      "create-deposit-instance",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: depositsQueryKeys.instancesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("trims name whitespace before calling RPC", async () => {
    const row: RpcRow = {
      id: DEPOSIT_INSTANCE_ID,
      settlement_id: SETTLEMENT_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      ...VALID_INPUT,
      name: "  Iron Deposit  ",
    });

    expect(calls.rpc).toHaveBeenCalledWith(
      "create_deposit_instance",
      expect.objectContaining({ p_name: "Iron Deposit" }),
    );
  });

  it("raises deposit_instance_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "deposit_instance_not_found" });
  });

  it("maps 42501 to deposit_instance_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "deposit_instance_not_authorized" });
  });

  it("maps P0002 to deposit_instance_deposit_type_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "deposit_instance_deposit_type_not_found",
    });
  });

  it("maps P0001 with 'trashed' to deposit_instance_deposit_type_trashed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "deposit type is trashed" },
    });
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "deposit_instance_deposit_type_trashed" });
  });

  it("maps generic P0001 to deposit_instance_resource_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "resource mismatch" },
    });
    const queryClient = createQueryClient();
    const options = createDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "deposit_instance_resource_invalid" });
  });
});
