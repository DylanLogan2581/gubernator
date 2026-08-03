import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  grantWorldAdminMutationOptions,
  revokeWorldAdminMutationOptions,
  setWorldRetentionConfigMutationOptions,
} from "./superadminMutations";

import type { SetWorldRetentionConfigInput } from "../types/superadminTypes";

describe("grantWorldAdminMutationOptions", () => {
  it("invalidates superadmin world-admins, world-access, and access-context on success", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = grantWorldAdminMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      userId: "user-1",
      worldId: "world-1",
    });

    expect(rpc).toHaveBeenCalledWith("grant_world_admin", {
      p_user_id: "user-1",
      p_world_id: "world-1",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["superadmin", "world-admins", "user-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["world-access", "current-user-admin-world-ids", "user-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["permissions", "current-access-context"],
    });
  });
});

describe("revokeWorldAdminMutationOptions", () => {
  it("invalidates superadmin world-admins, world-access, and access-context on success", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = revokeWorldAdminMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      userId: "user-1",
      worldId: "world-1",
    });

    expect(rpc).toHaveBeenCalledWith("revoke_world_admin", {
      p_user_id: "user-1",
      p_world_id: "world-1",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["superadmin", "world-admins", "user-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["world-access", "current-user-admin-world-ids", "user-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["permissions", "current-access-context"],
    });
  });
});

describe("setWorldRetentionConfigMutationOptions", () => {
  it("has a mutation key scoped to superadmin retention config", () => {
    const client = { from: vi.fn() } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setWorldRetentionConfigMutationOptions({
      client,
      queryClient,
    });

    expect(options.mutationKey).toEqual([
      "superadmin",
      "set-world-retention-config",
    ]);
    expect(typeof options.mutationFn).toBe("function");
  });

  it("upserts world_retention_config and invalidates the retention config query", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setWorldRetentionConfigMutationOptions({
      client,
      queryClient,
    });

    await executeRetentionMutation(queryClient, options, {
      logRetentionTurns: 50,
      memoryRetentionTurns: null,
      snapshotRetentionTurns: 100,
      worldId: "world-1",
    });

    expect(from).toHaveBeenCalledWith("world_retention_config");
    expect(upsert).toHaveBeenCalledWith(
      {
        log_retention_turns: 50,
        memory_retention_turns: null,
        snapshot_retention_turns: 100,
        world_id: "world-1",
      },
      { onConflict: "world_id" },
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["superadmin", "retention-config", "world-1"],
    });
  });

  it("maps a check-constraint violation to a friendly error", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: { code: "23514", message: "check constraint violated" },
    });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = setWorldRetentionConfigMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeRetentionMutation(queryClient, options, {
        logRetentionTurns: 0,
        memoryRetentionTurns: null,
        snapshotRetentionTurns: 100,
        worldId: "world-1",
      }),
    ).rejects.toThrow(
      "Retention values must be empty (keep all) or a whole number of at least 1.",
    );
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

type GrantOptions = ReturnType<typeof grantWorldAdminMutationOptions>;
type RevokeOptions = ReturnType<typeof revokeWorldAdminMutationOptions>;

function executeMutation<TOptions extends GrantOptions | RevokeOptions>(
  queryClient: QueryClient,
  options: TOptions,
  variables: Parameters<NonNullable<TOptions["mutationFn"]>>[0],
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

type SetRetentionOptions = ReturnType<
  typeof setWorldRetentionConfigMutationOptions
>;

function executeRetentionMutation(
  queryClient: QueryClient,
  options: SetRetentionOptions,
  variables: SetWorldRetentionConfigInput,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
