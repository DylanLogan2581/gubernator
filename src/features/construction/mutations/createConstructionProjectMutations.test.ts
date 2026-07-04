import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { buildingsQueryKeys } from "@/features/buildings";
import { settlementForecastQueryKeys } from "@/features/settlements";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createConstructionProjectMutationOptions,
  isConstructionProjectMutationError,
} from "./createConstructionProjectMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const BLUEPRINT_ID = "33333333-3333-3333-3333-333333333333";
const TIER_ID = "44444444-4444-4444-4444-444444444444";
const PROJECT_ID = "55555555-5555-5555-5555-555555555555";

const VALID_INPUT = {
  blueprintId: BLUEPRINT_ID,
  settlementId: SETTLEMENT_ID,
  targetTierId: TIER_ID,
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

describe("createConstructionProjectMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        blueprintId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isConstructionProjectMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls create_construction_project RPC and returns expected result", async () => {
    const row: RpcRow = { id: PROJECT_ID, settlement_id: SETTLEMENT_ID };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      projectId: PROJECT_ID,
      settlementId: SETTLEMENT_ID,
    });
    expect(calls.rpc).toHaveBeenCalledWith("create_construction_project", {
      p_blueprint_id: BLUEPRINT_ID,
      p_settlement_id: SETTLEMENT_ID,
      p_target_tier_id: TIER_ID,
    });
    expect(options.mutationKey).toEqual([
      "buildings",
      "create-construction-project",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          buildingsQueryKeys.constructionProjectsBySettlement(SETTLEMENT_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: settlementForecastQueryKeys.byWorld(WORLD_ID),
      }),
    );
  });

  it("invalidates using the settlementId returned by the RPC, not the input", async () => {
    const OTHER_SETTLEMENT_ID = "66666666-6666-6666-6666-666666666666";
    const row: RpcRow = {
      id: PROJECT_ID,
      settlement_id: OTHER_SETTLEMENT_ID,
    };
    const { client } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await executeMutation(queryClient, options, VALID_INPUT);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          buildingsQueryKeys.constructionProjectsBySettlement(
            OTHER_SETTLEMENT_ID,
          ),
      }),
    );
  });

  it("raises construction_project_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "construction_project_not_found" });
  });

  it("maps 42501 to construction_project_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "construction_project_not_authorized" });
  });

  it("maps P0001 to construction_project_blueprint_trashed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "blueprint is trashed" },
    });
    const queryClient = createQueryClient();
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "construction_project_blueprint_trashed",
    });
  });

  it("maps 23514 to construction_project_max_instances", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "23514", message: "max instances reached" },
    });
    const queryClient = createQueryClient();
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "construction_project_max_instances" });
  });

  it("maps P0002 to construction_project_blueprint_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = createConstructionProjectMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "construction_project_blueprint_not_found",
    });
  });
});
