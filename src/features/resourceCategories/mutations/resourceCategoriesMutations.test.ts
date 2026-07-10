import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createResourceCategoryMutationOptions,
  deleteResourceCategoryMutationOptions,
  isResourceCategoryMutationError,
  ResourceCategoryMutationError,
  updateResourceCategoryMutationOptions,
} from "./resourceCategoriesMutations";

const CATEGORY_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

type ResourceCategoryRow = {
  readonly color: string;
  readonly created_at: string;
  readonly icon: string | null;
  readonly id: string;
  readonly name: string;
  readonly sort_order: number;
  readonly updated_at: string;
  readonly world_id: string;
};

describe("createResourceCategoryMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isResourceCategoryMutationError);
    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_category_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts with trimmed name, default color, next sort order", async () => {
    const row = createResourceCategoryRow({ sort_order: 3 });
    const { client, calls } = createInsertClient({
      data: row,
      error: null,
      maxSortOrder: 2,
    });
    const queryClient = createQueryClient();
    const options = createResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      name: "  Raw Materials  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: CATEGORY_ID, name: row.name });
    expect(calls.from).toHaveBeenCalledWith("resource_categories");
    expect(calls.insert).toHaveBeenCalledWith({
      color: "#6b7280",
      icon: null,
      name: "Raw Materials",
      sort_order: 3,
      world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual([
      "resource-categories",
      "create-category",
    ]);
  });

  it("defaults sort order to 0 for the first category in a world", async () => {
    const row = createResourceCategoryRow({ sort_order: 0 });
    const { client, calls } = createInsertClient({
      data: row,
      error: null,
      maxSortOrder: null,
    });
    const queryClient = createQueryClient();
    const options = createResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      name: "Raw Materials",
      worldId: WORLD_ID,
    });

    expect(calls.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0 }),
    );
  });

  it("maps a 23505 unique violation to resource_category_name_taken", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
      maxSortOrder: null,
    });
    const queryClient = createQueryClient();
    const options = createResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Raw Materials",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_category_name_taken" });
  });

  it("maps a 42501 permission error to resource_category_forbidden", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
      maxSortOrder: null,
    });
    const queryClient = createQueryClient();
    const options = createResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Raw Materials",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_category_forbidden" });
  });

  it("normalizes other Supabase errors", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23514", message: "check constraint violated" },
      maxSortOrder: null,
    });
    const queryClient = createQueryClient();
    const options = createResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Raw Materials",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateResourceCategoryMutationOptions", () => {
  it("rejects an update with no updatable fields before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        categoryId: CATEGORY_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_category_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with trimmed name, scoped by id and world", async () => {
    const row = createResourceCategoryRow({ name: "Renamed" });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      categoryId: CATEGORY_ID,
      name: "  Renamed  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: CATEGORY_ID });
    expect(calls.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(calls.eqId).toHaveBeenCalledWith("id", CATEGORY_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
  });

  it("maps a 23505 unique violation to resource_category_name_taken", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = updateResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        categoryId: CATEGORY_ID,
        name: "Renamed",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_category_name_taken" });
  });
});

describe("deleteResourceCategoryMutationOptions", () => {
  it("deletes scoped by id and world", async () => {
    const { client, calls } = createDeleteClient({
      data: { id: CATEGORY_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      categoryId: CATEGORY_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ categoryId: CATEGORY_ID, worldId: WORLD_ID });
    expect(calls.eqId).toHaveBeenCalledWith("id", CATEGORY_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
  });

  it("raises resource_category_not_found when delete returns no row", async () => {
    const { client } = createDeleteClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = deleteResourceCategoryMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        categoryId: CATEGORY_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "resource_category_not_found" });
  });
});

describe("ResourceCategoryMutationError / isResourceCategoryMutationError", () => {
  it("identifies ResourceCategoryMutationError instances", () => {
    const err = new ResourceCategoryMutationError({
      code: "resource_category_not_found",
      message: "not found",
    });
    expect(isResourceCategoryMutationError(err)).toBe(true);
    expect(isResourceCategoryMutationError(new Error("other"))).toBe(false);
  });
});

function createResourceCategoryRow(
  overrides: Partial<ResourceCategoryRow> = {},
): ResourceCategoryRow {
  return {
    color: "#6b7280",
    created_at: "2026-05-01T00:00:00.000Z",
    icon: null,
    id: CATEGORY_ID,
    name: "Raw Materials",
    sort_order: 0,
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient({
  data,
  error,
  maxSortOrder,
}: {
  readonly data: ResourceCategoryRow | null;
  readonly error: SupabaseError | null;
  readonly maxSortOrder: number | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly insert: ReturnType<typeof vi.fn>;
  };
} {
  const insertMaybeSingle = vi.fn().mockResolvedValue({ data, error });
  const insertSelect = vi.fn(() => ({ maybeSingle: insertMaybeSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  const sortOrderMaybeSingle = vi.fn().mockResolvedValue({
    data: maxSortOrder === null ? null : { sort_order: maxSortOrder },
    error: null,
  });
  const sortOrderLimit = vi.fn(() => ({ maybeSingle: sortOrderMaybeSingle }));
  const sortOrderOrder = vi.fn(() => ({ limit: sortOrderLimit }));
  const sortOrderEq = vi.fn(() => ({ order: sortOrderOrder }));
  const select = vi.fn(() => ({ eq: sortOrderEq }));

  const from = vi.fn(() => ({ insert, select }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, insert },
  };
}

function createUpdateClient(result: SupabaseResult<ResourceCategoryRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorld: ReturnType<typeof vi.fn>;
    readonly from: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqWorld = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorld }));
  const update = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { eqId, eqWorld, from, update },
  };
}

function createDeleteClient(
  result: SupabaseResult<{ readonly id: string; readonly world_id: string }>,
): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorld: ReturnType<typeof vi.fn>;
    readonly from: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqWorld = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorld }));
  const deleteFn = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ delete: deleteFn }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { eqId, eqWorld, from },
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
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
