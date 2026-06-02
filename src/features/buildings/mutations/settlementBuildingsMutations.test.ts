import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { buildingsQueryKeys } from "../queries/buildingsQueryKeys";

import {
  isManualDeconstructBuildingMutationError,
  manualDeconstructBuildingMutationOptions,
} from "./settlementBuildingsMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const SETTLEMENT_BUILDING_ID = "22222222-2222-2222-2222-222222222222";

const VALID_INPUT = { settlementBuildingId: SETTLEMENT_BUILDING_ID };

type RpcRow = { readonly settlement_building_id: string };

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

describe("manualDeconstructBuildingMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = manualDeconstructBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        settlementBuildingId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isManualDeconstructBuildingMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls manual_deconstruct_settlement_building RPC and returns expected result", async () => {
    const row: RpcRow = { settlement_building_id: SETTLEMENT_BUILDING_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = manualDeconstructBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({ settlementBuildingId: SETTLEMENT_BUILDING_ID });
    expect(calls.rpc).toHaveBeenCalledWith(
      "manual_deconstruct_settlement_building",
      {
        p_settlement_building_id: SETTLEMENT_BUILDING_ID,
      },
    );
    expect(options.mutationKey).toEqual([
      "buildings",
      "manual-deconstruct-building",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          buildingsQueryKeys.settlementBuildingsBySettlement(SETTLEMENT_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: buildingsQueryKeys.settlementPopulationCap(SETTLEMENT_ID),
      }),
    );
  });

  it("raises manual_deconstruct_building_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = manualDeconstructBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "manual_deconstruct_building_not_found" });
  });

  it("maps 42501 to manual_deconstruct_building_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = manualDeconstructBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "manual_deconstruct_building_not_authorized",
    });
  });

  it("maps P0002 to manual_deconstruct_building_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = manualDeconstructBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "manual_deconstruct_building_not_found" });
  });

  it("maps P0001 to manual_deconstruct_building_wrong_state", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "building cannot be deconstructed" },
    });
    const queryClient = createQueryClient();
    const options = manualDeconstructBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "manual_deconstruct_building_wrong_state",
    });
  });
});

describe("isManualDeconstructBuildingMutationError", () => {
  it("identifies ManualDeconstructBuildingMutationError instances correctly", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = manualDeconstructBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    const err = await executeMutation(queryClient, options, {
      settlementBuildingId: "bad",
    }).catch((e: unknown) => e);

    expect(isManualDeconstructBuildingMutationError(err)).toBe(true);
    expect(isManualDeconstructBuildingMutationError(new Error("other"))).toBe(
      false,
    );
  });
});
