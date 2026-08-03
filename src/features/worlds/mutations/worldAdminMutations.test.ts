import { QueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createWorldMutationOptions,
  hardDeleteWorldMutationOptions,
  isWorldAdminError,
  restoreWorldMutationOptions,
  trashWorldMutationOptions,
} from "./worldAdminMutations";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createRpcClient<TData>(result: SupabaseResult<TData>): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutation<TData, TVariables>(
  queryClient: QueryClient,
  options: UseMutationOptions<TData, Error, TVariables>,
  variables: TVariables,
): Promise<TData> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

describe("createWorldMutationOptions", () => {
  it("creates a world and invalidates the worlds query root", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID, name: "Aetheria" },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = createWorldMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      name: "  Aetheria  ",
    });

    expect(result).toEqual({ id: WORLD_ID, name: "Aetheria" });
    expect(rpc).toHaveBeenCalledWith("create_world", { p_name: "Aetheria" });
    expect(options.mutationKey).toEqual(["worlds", "create-world"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("rejects a blank name before touching the DB", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { name: "   " }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createWorldMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, { name: "Aetheria" });

    await expect(result).rejects.toSatisfy(isWorldAdminError);
    await expect(result).rejects.toMatchObject({
      code: "world_admin_not_authorized",
    });
  });

  it("maps a null result to a not-found error", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { name: "Aetheria" }),
    ).rejects.toMatchObject({ code: "world_admin_not_found" });
  });
});

describe("trashWorldMutationOptions", () => {
  it("trashes a world and invalidates the worlds query root", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = trashWorldMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ worldId: WORLD_ID });
    expect(rpc).toHaveBeenCalledWith("trash_world", { p_world_id: WORLD_ID });
    expect(options.mutationKey).toEqual(["worlds", "trash-world"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("rejects an invalid world id before touching the DB", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = trashWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { worldId: "not-a-uuid" }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = trashWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { worldId: WORLD_ID }),
    ).rejects.toMatchObject({ code: "world_admin_not_authorized" });
  });

  it("maps a null result to a not-found error", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = trashWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { worldId: WORLD_ID }),
    ).rejects.toMatchObject({ code: "world_admin_not_found" });
  });
});

describe("restoreWorldMutationOptions", () => {
  it("restores a world and invalidates the worlds query root", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = restoreWorldMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ worldId: WORLD_ID });
    expect(rpc).toHaveBeenCalledWith("restore_world", {
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["worlds", "restore-world"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = restoreWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { worldId: WORLD_ID }),
    ).rejects.toMatchObject({ code: "world_admin_not_authorized" });
  });

  it("maps a null result to a not-found error", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = restoreWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { worldId: WORLD_ID }),
    ).rejects.toMatchObject({ code: "world_admin_not_found" });
  });
});

describe("hardDeleteWorldMutationOptions", () => {
  it("hard-deletes a world and invalidates the worlds query root", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = hardDeleteWorldMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ worldId: WORLD_ID });
    expect(rpc).toHaveBeenCalledWith("hard_delete_world", {
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["worlds", "hard-delete-world"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = hardDeleteWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { worldId: WORLD_ID }),
    ).rejects.toMatchObject({ code: "world_admin_not_authorized" });
  });

  it("maps a null result to a not-found error", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = hardDeleteWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { worldId: WORLD_ID }),
    ).rejects.toMatchObject({ code: "world_admin_not_found" });
  });
});
