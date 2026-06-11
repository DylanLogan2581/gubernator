import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { depositsQueryKeys } from "../queries/depositsQueryKeys";

import {
  hardDeleteDepositInstanceMutationOptions,
  isHardDeleteDepositInstanceMutationError,
} from "./hardDeleteDepositInstanceMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const DEPOSIT_INSTANCE_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = { depositInstanceId: DEPOSIT_INSTANCE_ID };

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

describe("hardDeleteDepositInstanceMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = hardDeleteDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        depositInstanceId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isHardDeleteDepositInstanceMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls hard_delete_deposit_instance RPC and returns expected result", async () => {
    const row: RpcRow = {
      id: DEPOSIT_INSTANCE_ID,
      settlement_id: SETTLEMENT_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = hardDeleteDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      depositInstanceId: DEPOSIT_INSTANCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("hard_delete_deposit_instance", {
      p_deposit_instance_id: DEPOSIT_INSTANCE_ID,
    });
    expect(options.mutationKey).toEqual([
      "deposits",
      "hard-delete-deposit-instance",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: depositsQueryKeys.instancesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("raises hard_delete_deposit_instance_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = hardDeleteDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "hard_delete_deposit_instance_not_found" });
  });

  it("maps 42501 to hard_delete_deposit_instance_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = hardDeleteDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "hard_delete_deposit_instance_not_authorized",
    });
  });

  it("maps P0002 to hard_delete_deposit_instance_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = hardDeleteDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "hard_delete_deposit_instance_not_found" });
  });

  it("maps P0001 to hard_delete_deposit_instance_not_removed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "P0001",
        message:
          "deposit instance must be removed before it can be permanently deleted",
      },
    });
    const queryClient = createQueryClient();
    const options = hardDeleteDepositInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "hard_delete_deposit_instance_not_removed",
    });
  });
});
