import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { citizensQueryKeys } from "@/features/citizens";
import { settlementForecastQueryKeys } from "@/features/settlements";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isSetConstructionProjectWorkersMutationError,
  setConstructionProjectWorkersMutationOptions,
} from "./setConstructionProjectWorkersMutations";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const CITIZEN_ID = "44444444-4444-4444-4444-444444444444";

const VALID_INPUT = {
  projectId: PROJECT_ID,
  settlementId: SETTLEMENT_ID,
  targetCount: 3,
};

type RpcRow = {
  readonly after: number;
  readonly added_citizen_ids: string[];
  readonly before: number;
  readonly removed_citizen_ids: string[];
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

describe("setConstructionProjectWorkersMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setConstructionProjectWorkersMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, {
        ...VALID_INPUT,
        targetCount: -1,
      }),
    ).rejects.toSatisfy(isSetConstructionProjectWorkersMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls set_construction_project_workers RPC and returns expected result", async () => {
    const row: RpcRow = {
      after: 3,
      added_citizen_ids: [CITIZEN_ID],
      before: 1,
      removed_citizen_ids: [],
    };
    const { client, calls } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = setConstructionProjectWorkersMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      after: 3,
      addedCitizenIds: [CITIZEN_ID],
      before: 1,
      removedCitizenIds: [],
    });
    expect(calls.rpc).toHaveBeenCalledWith("set_construction_project_workers", {
      p_project_id: PROJECT_ID,
      p_target_count: 3,
    });
    expect(options.mutationKey).toEqual([
      "buildings",
      "set-construction-project-workers",
    ]);
  });

  it("invalidates settlement-scoped citizen caches and the world-scoped forecast cache", async () => {
    const row: RpcRow = {
      after: 3,
      added_citizen_ids: [],
      before: 3,
      removed_citizen_ids: [],
    };
    const { client } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = setConstructionProjectWorkersMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await executeMutation(queryClient, options, VALID_INPUT);

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey:
          citizensQueryKeys.settlementConstructionProjectCounts(SETTLEMENT_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: citizensQueryKeys.settlementAggregateStats(SETTLEMENT_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: citizensQueryKeys.settlementList(SETTLEMENT_ID),
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [...citizensQueryKeys.all, "current-assignment-for-citizen"],
      }),
    );
    // Forecast cache is scoped by worldId, not settlementId (regression cover for #952).
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: settlementForecastQueryKeys.byWorld(WORLD_ID),
      }),
    );
  });

  it("raises set_workers_failed when RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setConstructionProjectWorkersMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_workers_failed" });
  });

  it("maps 42501 to set_workers_not_authorized", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setConstructionProjectWorkersMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_workers_not_authorized" });
  });

  it("maps P0002 to set_workers_not_found", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows" },
    });
    const queryClient = createQueryClient();
    const options = setConstructionProjectWorkersMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_workers_not_found" });
  });

  it("maps P0001 to set_workers_insufficient_npcs", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "insufficient unassigned npcs" },
    });
    const queryClient = createQueryClient();
    const options = setConstructionProjectWorkersMutationOptions({
      client,
      queryClient,
      worldId: WORLD_ID,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "set_workers_insufficient_npcs" });
  });
});
