import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createReligionMutationOptions,
  deleteReligionMutationOptions,
  isReligionMutationError,
  ReligionMutationError,
  updateReligionMutationOptions,
} from "./religionsMutations";

const RELIGION_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";

type ReligionRow = {
  readonly color: string;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly updated_at: string;
  readonly world_id: string;
};

describe("createReligionMutationOptions", () => {
  it("rejects a blank name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toSatisfy(isReligionMutationError);
    await expect(
      executeMutation(queryClient, options, {
        name: "   ",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts with trimmed name, default color, and null description", async () => {
    const row = createReligionRow();
    const { client, calls } = createInsertClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = createReligionMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      name: "  Sun Cult  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: RELIGION_ID, name: row.name });
    expect(calls.from).toHaveBeenCalledWith("religions");
    expect(calls.insert).toHaveBeenCalledWith({
      color: "#6b7280",
      description: null,
      name: "Sun Cult",
      world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["religions", "create-religion"]);
  });

  it("raises religion_not_found when insert returns no row", async () => {
    const { client } = createInsertClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Sun Cult",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_not_found" });
  });

  it("maps a 23505 unique violation to religion_name_taken", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = createReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Sun Cult",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_name_taken" });
  });

  it("maps a 42501 permission error to religion_forbidden", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Sun Cult",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_forbidden" });
  });

  it("normalizes other Supabase errors", async () => {
    const { client } = createInsertClient({
      data: null,
      error: { code: "23514", message: "check constraint violated" },
    });
    const queryClient = createQueryClient();
    const options = createReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "Sun Cult",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("updateReligionMutationOptions", () => {
  it("rejects an update with no updatable fields before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        religionId: RELIGION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with trimmed name, scoped by id and world", async () => {
    const row = createReligionRow({ name: "Renamed" });
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateReligionMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      religionId: RELIGION_ID,
      name: "  Renamed  ",
      worldId: WORLD_ID,
    });

    expect(result).toMatchObject({ id: RELIGION_ID });
    expect(calls.update).toHaveBeenCalledWith({ name: "Renamed" });
    expect(calls.eqId).toHaveBeenCalledWith("id", RELIGION_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
  });

  it("maps a lore field update to its snake_case column", async () => {
    const row = createReligionRow();
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateReligionMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      deities: "The Sunmother and her three sons.",
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith({
      deities: "The Sunmother and her three sons.",
    });
  });

  it("clears a lore field to null", async () => {
    const row = createReligionRow();
    const { client, calls } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = updateReligionMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      deities: null,
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith({ deities: null });
  });

  it("maps a 23505 unique violation to religion_name_taken", async () => {
    const { client } = createUpdateClient({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const queryClient = createQueryClient();
    const options = updateReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        religionId: RELIGION_ID,
        name: "Renamed",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_name_taken" });
  });
});

describe("deleteReligionMutationOptions", () => {
  it("calls delete_religion RPC with a null reassignment target by default", async () => {
    const { client, calls } = createDeleteClient({
      data: { id: RELIGION_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteReligionMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      religionId: RELIGION_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ religionId: RELIGION_ID, worldId: WORLD_ID });
    expect(calls.rpc).toHaveBeenCalledWith("delete_religion", {
      p_religion_id: RELIGION_ID,
      p_reassign_to_id: null,
    });
  });

  it("calls delete_religion RPC with the given reassignment target", async () => {
    const REASSIGN_TO_ID = "33333333-3333-3333-3333-333333333333";
    const { client, calls } = createDeleteClient({
      data: { id: RELIGION_ID, world_id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteReligionMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      religionId: RELIGION_ID,
      reassignToId: REASSIGN_TO_ID,
      worldId: WORLD_ID,
    });

    expect(calls.rpc).toHaveBeenCalledWith("delete_religion", {
      p_religion_id: RELIGION_ID,
      p_reassign_to_id: REASSIGN_TO_ID,
    });
  });

  it("raises religion_not_found when delete returns no row", async () => {
    const { client } = createDeleteClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = deleteReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        religionId: RELIGION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_not_found" });
  });

  it("maps a 42501 permission error to religion_forbidden", async () => {
    const { client } = createDeleteClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = deleteReligionMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        religionId: RELIGION_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "religion_forbidden" });
  });
});

describe("ReligionMutationError / isReligionMutationError", () => {
  it("identifies ReligionMutationError instances", () => {
    const err = new ReligionMutationError({
      code: "religion_not_found",
      message: "not found",
    });
    expect(isReligionMutationError(err)).toBe(true);
    expect(isReligionMutationError(new Error("other"))).toBe(false);
  });
});

function createReligionRow(overrides: Partial<ReligionRow> = {}): ReligionRow {
  return {
    color: "#6b7280",
    created_at: "2026-05-01T00:00:00.000Z",
    description: null,
    id: RELIGION_ID,
    name: "Sun Cult",
    updated_at: "2026-05-01T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createInsertClient(result: SupabaseResult<ReligionRow>): {
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

function createUpdateClient(result: SupabaseResult<ReligionRow>): {
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
