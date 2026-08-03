import { QueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  adminClearUserActivePlayerCharacterMutationOptions,
  adminSetUserActivePlayerCharacterMutationOptions,
  isAdminActivePlayerCharacterMutationError,
} from "./adminActivePlayerCharacterMutations";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";

type SupabaseError = { readonly code?: string; readonly message: string };

function createRpcClient(error: SupabaseError | null): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue({ error });
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

function executeMutation<TData, TError, TVariables>(
  queryClient: QueryClient,
  options: UseMutationOptions<TData, TError, TVariables>,
  variables: TVariables,
): Promise<TData> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

describe("adminSetUserActivePlayerCharacterMutationOptions", () => {
  it("calls the RPC and invalidates the affected query roots", async () => {
    const { client, rpc } = createRpcClient(null);
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = adminSetUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      userId: USER_ID,
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith("admin_set_user_active_player_character", {
      p_citizen_id: CITIZEN_ID,
      p_user_id: USER_ID,
      p_world_id: WORLD_ID,
    });
    expect(options.mutationKey).toEqual([
      "superadmin",
      "admin-set-active-player-character",
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "permissions",
        "active-player-character-row",
        USER_ID,
        WORLD_ID,
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "permissions",
        "selectable-player-characters",
        USER_ID,
        WORLD_ID,
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["superadmin", "user-active-pc-rows", USER_ID],
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      code: "42501",
      message: "permission denied",
    });
    const queryClient = createQueryClient();
    const options = adminSetUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    const result = executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      userId: USER_ID,
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(
      isAdminActivePlayerCharacterMutationError,
    );
    await expect(result).rejects.toMatchObject({
      code: "admin_apc_not_authorized",
    });
  });

  it("maps P0001 to a validation-failed error", async () => {
    const { client } = createRpcClient({
      code: "P0001",
      message: "citizen is not alive",
    });
    const queryClient = createQueryClient();
    const options = adminSetUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        userId: USER_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "admin_apc_validation_failed",
      message: "citizen is not alive",
    });
  });

  it("maps P0002 to a not-found error", async () => {
    const { client } = createRpcClient({
      code: "P0002",
      message: "citizen not found",
    });
    const queryClient = createQueryClient();
    const options = adminSetUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        userId: USER_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "admin_apc_not_found",
      message: "citizen not found",
    });
  });

  it("normalizes other Supabase errors", async () => {
    const { client } = createRpcClient({
      code: "23505",
      message: "conflict",
    });
    const queryClient = createQueryClient();
    const options = adminSetUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        userId: USER_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("adminClearUserActivePlayerCharacterMutationOptions", () => {
  it("calls the RPC and invalidates the affected query roots", async () => {
    const { client, rpc } = createRpcClient(null);
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = adminClearUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      userId: USER_ID,
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith(
      "admin_clear_user_active_player_character",
      {
        p_user_id: USER_ID,
        p_world_id: WORLD_ID,
      },
    );
    expect(options.mutationKey).toEqual([
      "superadmin",
      "admin-clear-active-player-character",
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "permissions",
        "active-player-character-row",
        USER_ID,
        WORLD_ID,
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "permissions",
        "selectable-player-characters",
        USER_ID,
        WORLD_ID,
      ],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["superadmin", "user-active-pc-rows", USER_ID],
    });
  });

  it("maps 42501 to a not-authorized error", async () => {
    const { client } = createRpcClient({
      code: "42501",
      message: "permission denied",
    });
    const queryClient = createQueryClient();
    const options = adminClearUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        userId: USER_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "admin_apc_not_authorized" });
  });

  it("normalizes other Supabase errors", async () => {
    const { client } = createRpcClient({
      code: "23505",
      message: "conflict",
    });
    const queryClient = createQueryClient();
    const options = adminClearUserActivePlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        userId: USER_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});
