import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";

import {
  isTransferManagedPopulationCountMutationError,
  transferManagedPopulationCountMutationOptions,
} from "./transferManagedPopulationCountMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const FROM_INSTANCE_ID = "33333333-3333-3333-3333-333333333333";
const TO_INSTANCE_ID = "44444444-4444-4444-4444-444444444444";

const VALID_INPUT = {
  fromManagedPopulationInstanceId: FROM_INSTANCE_ID,
  toManagedPopulationInstanceId: TO_INSTANCE_ID,
  count: 5,
};

type RpcRow = {
  readonly from_instance_id: string;
  readonly settlement_id: string;
  readonly to_instance_id: string;
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

describe("transferManagedPopulationCountMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = transferManagedPopulationCountMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        fromManagedPopulationInstanceId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isTransferManagedPopulationCountMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects the same instance for source and target before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = transferManagedPopulationCountMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        toManagedPopulationInstanceId: FROM_INSTANCE_ID,
      }),
    ).rejects.toMatchObject({
      code: "transfer_managed_population_count_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls transfer_managed_population_count RPC and returns expected result", async () => {
    const row: RpcRow = {
      from_instance_id: FROM_INSTANCE_ID,
      settlement_id: SETTLEMENT_ID,
      to_instance_id: TO_INSTANCE_ID,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = transferManagedPopulationCountMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      fromManagedPopulationInstanceId: FROM_INSTANCE_ID,
      settlementId: SETTLEMENT_ID,
      toManagedPopulationInstanceId: TO_INSTANCE_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      "transfer_managed_population_count",
      {
        p_from_instance_id: FROM_INSTANCE_ID,
        p_to_instance_id: TO_INSTANCE_ID,
        p_count: 5,
      },
    );
    expect(options.mutationKey).toEqual([
      "managed-populations",
      "transfer-managed-population-count",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          managedPopulationsQueryKeys.instancesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("raises transfer_managed_population_count_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = transferManagedPopulationCountMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "transfer_managed_population_count_not_found",
    });
  });

  it("maps 42501 to transfer_managed_population_count_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = transferManagedPopulationCountMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "transfer_managed_population_count_not_authorized",
    });
  });

  it("maps P0002 to transfer_managed_population_count_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = transferManagedPopulationCountMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "transfer_managed_population_count_not_found",
    });
  });

  it("maps P0001 to transfer_managed_population_count_values_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "transfer count must not exceed" },
    });
    const queryClient = createQueryClient();
    const options = transferManagedPopulationCountMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "transfer_managed_population_count_values_invalid",
    });
  });
});
