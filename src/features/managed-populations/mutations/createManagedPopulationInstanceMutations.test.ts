import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { managedPopulationsQueryKeys } from "../queries/managedPopulationsQueryKeys";

import {
  createManagedPopulationInstanceMutationOptions,
  isCreateManagedPopulationInstanceMutationError,
} from "./createManagedPopulationInstanceMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const TYPE_ID = "22222222-2222-2222-2222-222222222222";
const INSTANCE_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = {
  initialCount: 10,
  initialCullQuantity: 2,
  name: "Deer Herd Alpha",
  settlementId: SETTLEMENT_ID,
  typeId: TYPE_ID,
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

describe("createManagedPopulationInstanceMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, { ...VALID_INPUT, name: "" }),
    ).rejects.toSatisfy(isCreateManagedPopulationInstanceMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects cull quantity exceeding count before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        initialCount: 5,
        initialCullQuantity: 10,
      }),
    ).rejects.toMatchObject({
      code: "managed_population_instance_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls create_managed_population_instance RPC and returns expected result", async () => {
    const row: RpcRow = { id: INSTANCE_ID, settlement_id: SETTLEMENT_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      managedPopulationInstanceId: INSTANCE_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith(
      "create_managed_population_instance",
      expect.objectContaining({
        p_initial_count: 10,
        p_initial_cull_quantity: 2,
        p_name: "Deer Herd Alpha",
        p_settlement_id: SETTLEMENT_ID,
        p_type_id: TYPE_ID,
      }),
    );
    expect(options.mutationKey).toEqual([
      "managed-populations",
      "create-managed-population-instance",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          managedPopulationsQueryKeys.instancesBySettlement(SETTLEMENT_ID),
      }),
    );
  });

  it("trims name whitespace before calling RPC", async () => {
    const row: RpcRow = { id: INSTANCE_ID, settlement_id: SETTLEMENT_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      ...VALID_INPUT,
      name: "  Deer Herd  ",
    });

    expect(calls.rpc).toHaveBeenCalledWith(
      "create_managed_population_instance",
      expect.objectContaining({ p_name: "Deer Herd" }),
    );
  });

  it("raises managed_population_instance_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "managed_population_instance_not_found" });
  });

  it("maps 42501 to managed_population_instance_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "managed_population_instance_not_authorized",
    });
  });

  it("maps P0002 to managed_population_instance_type_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "managed_population_instance_type_not_found",
    });
  });

  it("maps P0001 with 'trashed' to managed_population_instance_type_trashed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "population type is trashed" },
    });
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "managed_population_instance_type_trashed",
    });
  });

  it("maps generic P0001 to managed_population_instance_values_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "some constraint violation" },
    });
    const queryClient = createQueryClient();
    const options = createManagedPopulationInstanceMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "managed_population_instance_values_invalid",
    });
  });
});
