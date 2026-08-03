import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createArmyGroupMutationOptions,
  deleteArmyGroupMutationOptions,
  deleteArmyUnitMutationOptions,
  isArmyTreeMutationError,
  moveArmyUnitMutationOptions,
} from "./armyTreeMutations";

const ARMY_ID = "11111111-1111-1111-1111-111111111111";
const GROUP_ID = "22222222-2222-2222-2222-222222222222";
const UNIT_ID = "33333333-3333-3333-3333-333333333333";
const UNIT_TYPE_ID = "44444444-4444-4444-4444-444444444444";

type SupabaseError = {
  readonly code?: string;
  readonly hint?: string;
  readonly message: string;
};
type SupabaseResult<T> =
  | { readonly data: T; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError };

function createRpcClient<T>(result: SupabaseResult<T>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: { readonly rpc: ReturnType<typeof vi.fn> };
} {
  const rpc = vi.fn().mockResolvedValue(result);
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

describe("createArmyGroupMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createArmyGroupMutationOptions({
      armyId: ARMY_ID,
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        armyId: ARMY_ID,
        name: "",
        parentGroupId: null,
      }),
    ).rejects.toSatisfy(isArmyTreeMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes a null parent group id for a root-level group", async () => {
    const { client, calls } = createRpcClient({
      data: {
        army_id: ARMY_ID,
        created_at: "2026-01-01T00:00:00.000Z",
        id: GROUP_ID,
        name: "1st Division",
        parent_group_id: null,
        sort_order: 0,
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createArmyGroupMutationOptions({
      armyId: ARMY_ID,
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      armyId: ARMY_ID,
      name: "1st Division",
      parentGroupId: null,
    });

    expect(result).toMatchObject({ id: GROUP_ID, parentGroupId: null });
    expect(calls.rpc).toHaveBeenCalledWith("create_army_group", {
      p_army_id: ARMY_ID,
      p_name: "1st Division",
      p_parent_group_id: null,
      p_sort_order: undefined,
    });
  });

  it("maps the depth_exceeded hint to a friendly message", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "22023",
        hint: "depth_exceeded",
        message: "group nesting depth exceeded",
      },
    });
    const queryClient = createQueryClient();
    const options = createArmyGroupMutationOptions({
      armyId: ARMY_ID,
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        armyId: ARMY_ID,
        name: "Too deep",
        parentGroupId: GROUP_ID,
      }),
    ).rejects.toMatchObject({ code: "army_tree_depth_exceeded" });
  });
});

describe("deleteArmyGroupMutationOptions", () => {
  it("maps the group_not_empty hint to the exact guard message", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "22023",
        hint: "group_not_empty",
        message: "group still has children",
      },
    });
    const queryClient = createQueryClient();
    const options = deleteArmyGroupMutationOptions({
      armyId: ARMY_ID,
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, { groupId: GROUP_ID }),
    ).rejects.toMatchObject({
      code: "army_tree_group_not_empty",
      message:
        "Group must have no child groups or units before it can be deleted.",
    });
  });
});

describe("deleteArmyUnitMutationOptions", () => {
  it("maps the unit_not_empty hint to the exact guard message", async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: "22023",
        hint: "unit_not_empty",
        message: "unit still has soldiers",
      },
    });
    const queryClient = createQueryClient();
    const options = deleteArmyUnitMutationOptions({
      armyId: ARMY_ID,
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, { unitId: UNIT_ID }),
    ).rejects.toMatchObject({
      code: "army_tree_unit_not_empty",
      message: "Unit must have no soldiers before it can be deleted.",
    });
  });
});

describe("moveArmyUnitMutationOptions", () => {
  it("passes a null group id when moving a unit to the army root", async () => {
    const { client, calls } = createRpcClient({
      data: {
        army_id: ARMY_ID,
        created_at: "2026-01-01T00:00:00.000Z",
        created_turn_number: 1,
        group_id: null,
        id: UNIT_ID,
        name: "1st Company",
        sort_order: 0,
        unit_type_id: UNIT_TYPE_ID,
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = moveArmyUnitMutationOptions({
      armyId: ARMY_ID,
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      groupId: null,
      sortOrder: 0,
      unitId: UNIT_ID,
    });

    expect(calls.rpc).toHaveBeenCalledWith("move_army_unit", {
      p_group_id: null,
      p_sort_order: 0,
      p_unit_id: UNIT_ID,
    });
  });
});
