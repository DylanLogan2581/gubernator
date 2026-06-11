import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { buildingsQueryKeys } from "../queries/buildingsQueryKeys";

import {
  addSettlementBuildingMutationOptions,
  isAddSettlementBuildingMutationError,
} from "./addSettlementBuildingMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const BLUEPRINT_ID = "22222222-2222-2222-2222-222222222222";
const TIER_ID = "33333333-3333-3333-3333-333333333333";
const BUILDING_ID = "44444444-4444-4444-4444-444444444444";

const VALID_INPUT = {
  blueprintId: BLUEPRINT_ID,
  settlementId: SETTLEMENT_ID,
  tierId: TIER_ID,
};

type RpcRow = { readonly id: string };

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

describe("addSettlementBuildingMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        blueprintId: "not-a-uuid",
        settlementId: SETTLEMENT_ID,
        tierId: TIER_ID,
      }),
    ).rejects.toSatisfy(isAddSettlementBuildingMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls add_settlement_building_as_admin RPC and returns expected result", async () => {
    const row: RpcRow = { id: BUILDING_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({ settlementBuildingId: BUILDING_ID });
    expect(calls.rpc).toHaveBeenCalledWith("add_settlement_building_as_admin", {
      p_blueprint_id: BLUEPRINT_ID,
      p_name: undefined,
      p_settlement_id: SETTLEMENT_ID,
      p_tier_id: TIER_ID,
    });
    expect(options.mutationKey).toEqual([
      "buildings",
      "add-settlement-building",
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

  it("passes name to RPC when provided", async () => {
    const row: RpcRow = { id: BUILDING_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await executeMutation(queryClient, options, {
      ...VALID_INPUT,
      name: "My Special Building",
    });

    expect(calls.rpc).toHaveBeenCalledWith("add_settlement_building_as_admin", {
      p_blueprint_id: BLUEPRINT_ID,
      p_name: "My Special Building",
      p_settlement_id: SETTLEMENT_ID,
      p_tier_id: TIER_ID,
    });
  });

  it("raises add_settlement_building_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "add_settlement_building_not_found" });
  });

  it("maps 42501 to add_settlement_building_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "add_settlement_building_not_authorized",
    });
  });

  it("maps P0002 to add_settlement_building_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "add_settlement_building_not_found" });
  });

  it("maps P0001 to add_settlement_building_blueprint_trashed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "blueprint is trashed" },
    });
    const queryClient = createQueryClient();
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "add_settlement_building_blueprint_trashed",
    });
  });
});

describe("isAddSettlementBuildingMutationError", () => {
  it("identifies AddSettlementBuildingMutationError instances correctly", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = addSettlementBuildingMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
    });

    const err = await executeMutation(queryClient, options, {
      blueprintId: "bad",
      settlementId: SETTLEMENT_ID,
      tierId: TIER_ID,
    }).catch((e: unknown) => e);

    expect(isAddSettlementBuildingMutationError(err)).toBe(true);
    expect(isAddSettlementBuildingMutationError(new Error("other"))).toBe(
      false,
    );
  });
});
