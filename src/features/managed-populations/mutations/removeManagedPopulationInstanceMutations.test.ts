import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";

import {
  isRemoveManagedPopulationInstanceMutationError,
  removeManagedPopulationInstanceMutationOptions,
} from "./removeManagedPopulationInstanceMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const INSTANCE_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = { managedPopulationInstanceId: INSTANCE_ID };

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

describe("removeManagedPopulationInstanceMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = removeManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        managedPopulationInstanceId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isRemoveManagedPopulationInstanceMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls remove_managed_population_instance RPC and returns expected result", async () => {
    const row: RpcRow = { id: INSTANCE_ID, settlement_id: SETTLEMENT_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = removeManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      managedPopulationInstanceId: INSTANCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      "remove_managed_population_instance",
      {
        p_instance_id: INSTANCE_ID,
      },
    );
    expect(options.mutationKey).toEqual([
      "managed-populations",
      "remove-managed-population-instance",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          managedPopulationsQueryKeys.instancesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("raises remove_managed_population_instance_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = removeManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "remove_managed_population_instance_not_found",
    });
  });

  it("maps 42501 to remove_managed_population_instance_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = removeManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "remove_managed_population_instance_not_authorized",
    });
  });

  it("maps P0002 to remove_managed_population_instance_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = removeManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "remove_managed_population_instance_not_found",
    });
  });

  it("maps P0001 with 'already extinct' to remove_managed_population_instance_already_extinct", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "population is already extinct" },
    });
    const queryClient = createQueryClient();
    const options = removeManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "remove_managed_population_instance_already_extinct",
    });
  });

  it("maps generic P0001 to remove_managed_population_instance_blocked", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "cannot remove due to active jobs" },
    });
    const queryClient = createQueryClient();
    const options = removeManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "remove_managed_population_instance_blocked",
    });
  });
});
