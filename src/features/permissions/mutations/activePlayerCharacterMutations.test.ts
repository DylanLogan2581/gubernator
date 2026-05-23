import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  clearActivePlayerCharacterMutationOptions,
  setActivePlayerCharacterMutationOptions,
} from "./activePlayerCharacterMutations";

describe("setActivePlayerCharacterMutationOptions", () => {
  it("upserts the active row and invalidates role-dependent query roots", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      citizenId: "citizen-1",
      userId: "user-1",
      worldId: "world-1",
    });

    expect(from).toHaveBeenCalledWith("user_active_player_characters");
    expect(upsert).toHaveBeenCalledWith(
      {
        citizen_id: "citizen-1",
        user_id: "user-1",
        world_id: "world-1",
      },
      { onConflict: "user_id,world_id" },
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "permissions",
        "active-player-character-row",
        "user-1",
        "world-1",
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements"],
    });
  });

  it("normalizes Supabase upsert errors", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: { code: "42501", message: "permission denied" },
    });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: "citizen-1",
        userId: "user-1",
        worldId: "world-1",
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("clearActivePlayerCharacterMutationOptions", () => {
  it("deletes the row scoped to user/world and invalidates query roots", async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const del = vi.fn(() => ({ eq: eq1 }));
    const from = vi.fn(() => ({ delete: del }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = clearActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      userId: "user-1",
      worldId: "world-1",
    });

    expect(from).toHaveBeenCalledWith("user_active_player_characters");
    expect(del).toHaveBeenCalled();
    expect(eq1).toHaveBeenCalledWith("user_id", "user-1");
    expect(eq2).toHaveBeenCalledWith("world_id", "world-1");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "permissions",
        "active-player-character-row",
        "user-1",
        "world-1",
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens"],
    });
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

type SetMutationOptions = ReturnType<
  typeof setActivePlayerCharacterMutationOptions
>;
type ClearMutationOptions = ReturnType<
  typeof clearActivePlayerCharacterMutationOptions
>;

function executeMutation<
  TOptions extends SetMutationOptions | ClearMutationOptions,
>(
  queryClient: QueryClient,
  options: TOptions,
  variables: Parameters<NonNullable<TOptions["mutationFn"]>>[0],
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables as never);
}
