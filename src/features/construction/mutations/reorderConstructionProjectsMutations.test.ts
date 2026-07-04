import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { buildingsQueryKeys } from "@/features/buildings";
import { settlementForecastQueryKeys } from "@/features/settlements";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isReorderConstructionProjectsMutationError,
  reorderConstructionProjectsMutationOptions,
} from "./reorderConstructionProjectsMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_A = "33333333-3333-3333-3333-333333333333";
const PROJECT_B = "44444444-4444-4444-4444-444444444444";

const VALID_INPUT = {
  positions: [
    { position: 2, projectId: PROJECT_A },
    { position: 1, projectId: PROJECT_B },
  ],
  settlementId: SETTLEMENT_ID,
};

type RpcRow = { readonly updated_count: number };

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

describe("reorderConstructionProjectsMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = reorderConstructionProjectsMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        settlementId: "not-a-uuid",
      }),
    ).rejects.toSatisfy(isReorderConstructionProjectsMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls reorder_construction_projects RPC and returns expected result", async () => {
    const row: RpcRow = { updated_count: 2 };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = reorderConstructionProjectsMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({ updatedCount: 2 });
    expect(calls.rpc).toHaveBeenCalledWith("reorder_construction_projects", {
      p_positions: [
        { position: 2, projectId: PROJECT_A },
        { position: 1, projectId: PROJECT_B },
      ],
      p_settlement_id: SETTLEMENT_ID,
    });
    expect(options.mutationKey).toEqual([
      "buildings",
      "reorder-construction-projects",
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

  it("raises reorder_construction_projects_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = reorderConstructionProjectsMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "reorder_construction_projects_not_found",
    });
  });

  it("maps 42501 to reorder_construction_projects_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = reorderConstructionProjectsMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "reorder_construction_projects_not_authorized",
    });
  });

  it("maps P0002 to reorder_construction_projects_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = reorderConstructionProjectsMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "reorder_construction_projects_not_found",
    });
  });

  it("maps P0001 to reorder_construction_projects_positions_invalid", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "positions list is invalid" },
    });
    const queryClient = createQueryClient();
    const options = reorderConstructionProjectsMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "reorder_construction_projects_positions_invalid",
    });
  });
});
