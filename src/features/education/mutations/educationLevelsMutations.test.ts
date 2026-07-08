import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createEducationLevelMutationOptions,
  deleteEducationLevelMutationOptions,
  isEducationLevelMutationError,
  EducationLevelMutationError,
  reorderEducationLevelMutationOptions,
  updateEducationLevelMutationOptions,
} from "./educationLevelsMutations";

const EDUCATION_LEVEL_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

type EducationLevelRow = {
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly rank: number;
  readonly updated_at: string;
  readonly world_id: string;
};

describe("createEducationLevelMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isEducationLevelMutationError);
    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the create RPC with trimmed name and null description", async () => {
    const row = createEducationLevelRow();
    const { client, calls } = createCreateRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createEducationLevelMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      name: "  Illiterate  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: EDUCATION_LEVEL_ID, name: row.name });
    expect(calls.rpc).toHaveBeenCalledWith("create_education_level", {
      p_description: null,
      p_name: "Illiterate",
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual([
      "education-levels",
      "create-education-level",
    ]);
  });

  it("raises education_level_not_found when the RPC returns no row", async () => {
    const { client } = createCreateRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Illiterate",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_not_found" });
  });

  it("maps a 23505 unique violation to education_level_name_taken", async () => {
    const { client } = createCreateRpcClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = createEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Illiterate",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_name_taken" });
  });

  it("maps a 42501 permission error to education_level_forbidden", async () => {
    const { client } = createCreateRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Illiterate",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_forbidden" });
  });

  it("normalizes other Supabase errors", async () => {
    const { client } = createCreateRpcClient({
      data: null,
      error: { code: "23514", message: "check constraint violated" },
    });
    const queryClient = createQueryClient();
    const options = createEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        name: "Illiterate",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateEducationLevelMutationOptions", () => {
  it("rejects an update with no updatable fields before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        educationLevelId: EDUCATION_LEVEL_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with trimmed name, scoped by id and world", async () => {
    const row = createEducationLevelRow({ name: "Renamed" });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateEducationLevelMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      educationLevelId: EDUCATION_LEVEL_ID,
      name: "  Renamed  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: EDUCATION_LEVEL_ID });
    expect(calls.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(calls.eqId).toHaveBeenCalledWith("id", EDUCATION_LEVEL_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
  });

  it("maps a 23505 unique violation to education_level_name_taken", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = updateEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        educationLevelId: EDUCATION_LEVEL_ID,
        name: "Renamed",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_name_taken" });
  });
});

describe("deleteEducationLevelMutationOptions", () => {
  it("deletes scoped by id and world", async () => {
    const { client, calls } = createDeleteClient({
      data: { id: EDUCATION_LEVEL_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteEducationLevelMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });
    expect(calls.eqId).toHaveBeenCalledWith("id", EDUCATION_LEVEL_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
  });

  it("raises education_level_not_found when delete returns no row", async () => {
    const { client } = createDeleteClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = deleteEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        educationLevelId: EDUCATION_LEVEL_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_not_found" });
  });

  it("maps a 23503 foreign key violation to education_level_in_use", async () => {
    const { client } = createDeleteClient({
      data: null,
      error: { code: "23503", message: "foreign key violation" },
    });
    const queryClient = createQueryClient();
    const options = deleteEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        educationLevelId: EDUCATION_LEVEL_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_in_use" });
  });
});

describe("reorderEducationLevelMutationOptions", () => {
  it("calls the reorder RPC with the direction and level id", async () => {
    const rows = [
      createEducationLevelRow({ rank: 1 }),
      createEducationLevelRow({
        id: "33333333-3333-3333-3333-333333333333",
        rank: 2,
      }),
    ];
    const rpc = vi.fn().mockResolvedValue({ data: rows, error: null });
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = reorderEducationLevelMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      direction: "up",
      educationLevelId: EDUCATION_LEVEL_ID,
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith("reorder_education_level", {
      p_direction: "up",
      p_level_id: EDUCATION_LEVEL_ID,
    });
    expect(result).toHaveLength(2);
  });

  it("maps a P0001 error to education_level_no_adjacent", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "no neighbor" },
    });
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = reorderEducationLevelMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        direction: "up",
        educationLevelId: EDUCATION_LEVEL_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "education_level_no_adjacent" });
  });
});

describe("EducationLevelMutationError / isEducationLevelMutationError", () => {
  it("identifies EducationLevelMutationError instances", () => {
    const err = new EducationLevelMutationError({
      code: "education_level_not_found",
      message: "not found",
    });
    expect(isEducationLevelMutationError(err)).toBe(true);
    expect(isEducationLevelMutationError(new Error("other"))).toBe(false);
  });
});

function createEducationLevelRow(
  overrides: Partial<EducationLevelRow> = {},
): EducationLevelRow {
  return {
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    id: EDUCATION_LEVEL_ID,
    name: "Illiterate",
    rank: 1,
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createCreateRpcClient(result: SupabaseResult<EducationLevelRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly rpc: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return {
    client: { rpc } as unknown as GubernatorSupabaseClient,
    calls: { rpc },
  };
}

function createUpdateClient(result: SupabaseResult<EducationLevelRow>): {
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
