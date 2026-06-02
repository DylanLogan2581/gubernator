import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { citizensQueryKeys } from "../queries/citizensQueryKeys";

import {
  BulkConstructionAssignmentMutationError,
  isBulkConstructionAssignmentMutationError,
  setBulkConstructionAssignmentMutationOptions,
} from "./bulkConstructionAssignmentMutations";

const CONSTRUCTION_PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const CITIZEN_A_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_B_ID = "33333333-3333-3333-3333-333333333333";

const VALID_INPUT = {
  constructionProjectId: CONSTRUCTION_PROJECT_ID,
  targetCount: 2,
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
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
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

describe("setBulkConstructionAssignmentMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setBulkConstructionAssignmentMutationOptions({
      client,
      queryClient,
    });

    const result = executeMutation(queryClient, options, {
      ...VALID_INPUT,
      targetCount: -1,
    });

    await expect(result).rejects.toSatisfy(
      isBulkConstructionAssignmentMutationError,
    );
    await expect(result).rejects.toMatchObject({
      code: "bulk_assignment_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls set_bulk_construction_assignment RPC and returns the mapped result", async () => {
    const row: RpcRow = {
      after: 2,
      added_citizen_ids: [CITIZEN_A_ID, CITIZEN_B_ID],
      before: 0,
      removed_citizen_ids: [],
    };
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = setBulkConstructionAssignmentMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, VALID_INPUT);

    expect(result).toEqual({
      after: 2,
      addedCitizenIds: [CITIZEN_A_ID, CITIZEN_B_ID],
      before: 0,
      removedCitizenIds: [],
    });
    expect(rpc).toHaveBeenCalledWith("set_bulk_construction_assignment", {
      p_construction_project_id: CONSTRUCTION_PROJECT_ID,
      p_target_count: 2,
    });
    expect(options.mutationKey).toEqual([
      "citizens",
      "set-bulk-construction-assignment",
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [...citizensQueryKeys.all, "assignments-in-settlement"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        ...citizensQueryKeys.all,
        "settlement-construction-project-counts",
      ],
    });
  });

  it("raises bulk_assignment_failed when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setBulkConstructionAssignmentMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toBeInstanceOf(BulkConstructionAssignmentMutationError);
    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toMatchObject({ code: "bulk_assignment_failed" });
  });

  it("maps 42501 to AuthUiError", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setBulkConstructionAssignmentMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("maps P0002 to AuthUiError", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0002", message: "no rows found" },
    });
    const queryClient = createQueryClient();
    const options = setBulkConstructionAssignmentMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("maps P0001 'insufficient unassigned NPCs available' to AuthUiError", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "P0001",
        message: "insufficient unassigned NPCs available",
      },
    });
    const queryClient = createQueryClient();
    const options = setBulkConstructionAssignmentMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("maps P0001 'target count exceeds settlement job capacity' to AuthUiError", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "P0001",
        message: "target count exceeds settlement job capacity",
      },
    });
    const queryClient = createQueryClient();
    const options = setBulkConstructionAssignmentMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, VALID_INPUT),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});
