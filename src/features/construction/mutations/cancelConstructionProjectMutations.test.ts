import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { buildingsQueryKeys } from "@/features/buildings";
import { settlementForecastQueryKeys } from "@/features/settlements";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  cancelConstructionProjectMutationOptions,
  isCancelConstructionProjectMutationError,
} from "./cancelConstructionProjectMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = { projectId: PROJECT_ID };

type RpcRow = {
  readonly project_id: string;
  readonly unassigned_citizen_count: number;
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

describe("cancelConstructionProjectMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = cancelConstructionProjectMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, { projectId: "not-a-uuid" }),
    ).rejects.toSatisfy(isCancelConstructionProjectMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls cancel_construction_project RPC and returns expected result", async () => {
    const row: RpcRow = {
      project_id: PROJECT_ID,
      unassigned_citizen_count: 2,
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = cancelConstructionProjectMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      projectId: PROJECT_ID,
      unassignedCitizenCount: 2,
    });
    expect(calls.rpc).toHaveBeenCalledWith("cancel_construction_project", {
      p_project_id: PROJECT_ID,
    });
    expect(options.mutationKey).toEqual([
      "buildings",
      "cancel-construction-project",
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

  it("raises cancel_construction_project_not_found when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = cancelConstructionProjectMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "cancel_construction_project_not_found" });
  });

  it("maps 42501 to cancel_construction_project_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = cancelConstructionProjectMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "cancel_construction_project_not_authorized",
    });
  });

  it("maps P0002 to cancel_construction_project_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = cancelConstructionProjectMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "cancel_construction_project_not_found" });
  });

  it("maps P0001 to cancel_construction_project_already_terminal", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "project is already complete" },
    });
    const queryClient = createQueryClient();
    const options = cancelConstructionProjectMutationOptions({
      client,
      queryClient,
      settlementId: SETTLEMENT_ID,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({
      code: "cancel_construction_project_already_terminal",
    });
  });
});
