import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  grantWorldAdminMutationOptions,
  revokeWorldAdminMutationOptions,
} from "./superadminMutations";

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
