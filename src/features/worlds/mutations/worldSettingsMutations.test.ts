import { QueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isWorldSettingsError,
  renameWorldMutationOptions,
  setWorldCurrentTurnNumberMutationOptions,
} from "./worldSettingsMutations";

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

describe("renameWorldMutationOptions", () => {
  it("renames a world and invalidates the worlds query root", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID, name: "New Name" },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = renameWorldMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      name: "  New Name  ",
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ id: WORLD_ID, name: "New Name" });
    expect(rpc).toHaveBeenCalledWith("rename_world", {
      p_name: "New Name",
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual(["worlds", "rename-world"]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("rejects a blank name before touching the DB", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = renameWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, { name: "   ", worldId: WORLD_ID }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = renameWorldMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      name: "New Name",
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isWorldSettingsError);
    await expect(result).rejects.toMatchObject({
      code: "world_settings_not_authorized",
    });
  });

  it("maps a null result to a not-found error", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = renameWorldMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        name: "New Name",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "world_settings_not_found" });
  });
});

describe("setWorldCurrentTurnNumberMutationOptions", () => {
  it("sets the current turn number and invalidates the worlds query root", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID, current_turn_number: 5 },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setWorldCurrentTurnNumberMutationOptions({
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      turnNumber: 5,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ id: WORLD_ID, current_turn_number: 5 });
    expect(rpc).toHaveBeenCalledWith("set_world_current_turn_number", {
      p_turn_number: 5,
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual([
      "worlds",
      "set-world-current-turn-number",
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["worlds"] });
  });

  it("rejects a negative turn number before touching the DB", async () => {
    const { client, rpc } = createRpcClient({
      data: { id: WORLD_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = setWorldCurrentTurnNumberMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        turnNumber: -1,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = setWorldCurrentTurnNumberMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        turnNumber: 5,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "world_settings_not_authorized" });
  });

  it("maps 23514 to a snapshot-conflict error", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "23514", message: "check constraint violated" },
    });
    const queryClient = createQueryClient();
    const options = setWorldCurrentTurnNumberMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        turnNumber: 5,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "world_settings_snapshot_conflict" });
  });

  it("maps a null result to a not-found error", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = setWorldCurrentTurnNumberMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        turnNumber: 5,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "world_settings_not_found" });
  });
});
