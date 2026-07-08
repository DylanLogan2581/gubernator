import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createCultureMutationOptions,
  deleteCultureMutationOptions,
  isCultureMutationError,
  CultureMutationError,
  updateCultureMutationOptions,
} from "./culturesMutations";

const CULTURE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

type CultureRow = {
  readonly color: string;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

describe("createCultureMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isCultureMutationError);
    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "culture_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts with trimmed name, default color, and null description", async () => {
    const row = createCultureRow();
    const { client, calls } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createCultureMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      name: "  Coastal Folk  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: CULTURE_ID, name: row.name });
    expect(calls.from).toHaveBeenCalledWith("cultures");
    expect(calls.insert).toHaveBeenCalledWith({
      color: "#6b7280",
      description: null,
      name: "Coastal Folk",
      world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["cultures", "create-culture"]);
  });

  it("raises culture_not_found when insert returns no row", async () => {
    const { client } = createInsertClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Coastal Folk",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "culture_not_found" });
  });

  it("maps a 23505 unique violation to culture_name_taken", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = createCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Coastal Folk",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "culture_name_taken" });
  });

  it("maps a 42501 permission error to culture_forbidden", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Coastal Folk",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "culture_forbidden" });
  });

  it("normalizes other Supabase errors", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23514", message: "check constraint violated" },
    });
    const queryClient = createQueryClient();
    const options = createCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Coastal Folk",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateCultureMutationOptions", () => {
  it("rejects an update with no updatable fields before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        cultureId: CULTURE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "culture_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with trimmed name, scoped by id and world", async () => {
    const row = createCultureRow({ name: "Renamed" });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateCultureMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      cultureId: CULTURE_ID,
      name: "  Renamed  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: CULTURE_ID });
    expect(calls.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(calls.eqId).toHaveBeenCalledWith("id", CULTURE_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
  });

  it("maps a 23505 unique violation to culture_name_taken", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = updateCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        cultureId: CULTURE_ID,
        name: "Renamed",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "culture_name_taken" });
  });
});

describe("deleteCultureMutationOptions", () => {
  it("deletes scoped by id and world", async () => {
    const { client, calls } = createDeleteClient({
      data: { id: CULTURE_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteCultureMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      cultureId: CULTURE_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ cultureId: CULTURE_ID, worldId: WORLD_ID });
    expect(calls.eqId).toHaveBeenCalledWith("id", CULTURE_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
  });

  it("raises culture_not_found when delete returns no row", async () => {
    const { client } = createDeleteClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = deleteCultureMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        cultureId: CULTURE_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "culture_not_found" });
  });
});

describe("CultureMutationError / isCultureMutationError", () => {
  it("identifies CultureMutationError instances", () => {
    const err = new CultureMutationError({
      code: "culture_not_found",
      message: "not found",
    });
    expect(isCultureMutationError(err)).toBe(true);
    expect(isCultureMutationError(new Error("other"))).toBe(false);
  });
});

function createCultureRow(overrides: Partial<CultureRow> = {}): CultureRow {
  return {
    color: "#6b7280",
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    id: CULTURE_ID,
    name: "Coastal Folk",
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<CultureRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly insert: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, insert },
  };
}

function createUpdateClient(result: SupabaseResult<CultureRow>): {
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
