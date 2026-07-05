import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { notificationQueryKeys } from "../queries/notificationQueryKeys";

import { setNotificationPreferenceMutationOptions } from "./notificationPreferencesMutations";

import type { NotificationPreference } from "../queries/notificationPreferencesQueries";

const USER_ID = "user-1";

describe("setNotificationPreferenceMutationOptions", () => {
  it("deletes the preference row when re-enabling a type (the default)", async () => {
    const deleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const deleteEq1 = vi.fn(() => ({ eq: deleteEq2 }));
    const deleteFn = vi.fn(() => ({ eq: deleteEq1 }));
    const upsert = vi.fn();
    const from = vi.fn(() => ({ delete: deleteFn, upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await executeMutation(
      queryClient,
      setNotificationPreferenceMutationOptions({ client, queryClient }),
      { enabled: true, notificationType: "turn.completed", userId: USER_ID },
    );

    expect(from).toHaveBeenCalledWith("notification_preferences");
    expect(deleteEq1).toHaveBeenCalledWith("user_id", USER_ID);
    expect(deleteEq2).toHaveBeenCalledWith(
      "notification_type",
      "turn.completed",
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts a disabled row when muting a type", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await executeMutation(
      queryClient,
      setNotificationPreferenceMutationOptions({ client, queryClient }),
      { enabled: false, notificationType: "turn.completed", userId: USER_ID },
    );

    expect(upsert).toHaveBeenCalledWith(
      {
        enabled: false,
        notification_type: "turn.completed",
        user_id: USER_ID,
      },
      { onConflict: "user_id,notification_type" },
    );
  });

  it("normalizes a Supabase error from the upsert", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: { code: "42501", message: "permission denied" },
    });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    await expect(
      executeMutation(
        queryClient,
        setNotificationPreferenceMutationOptions({ client, queryClient }),
        { enabled: false, notificationType: "turn.completed", userId: USER_ID },
      ),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("optimistically disables the type in the cache before the request resolves", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const queryKey = notificationQueryKeys.preferences(USER_ID);
    const initialPreferences: readonly NotificationPreference[] = [
      { enabled: true, notificationType: "turn.completed" },
      { enabled: true, notificationType: "citizen.born" },
    ];
    queryClient.setQueryData(queryKey, initialPreferences);

    await executeMutation(
      queryClient,
      setNotificationPreferenceMutationOptions({ client, queryClient }),
      { enabled: false, notificationType: "turn.completed", userId: USER_ID },
    );

    expect(
      queryClient.getQueryData<readonly NotificationPreference[]>(queryKey),
    ).toEqual([
      { enabled: false, notificationType: "turn.completed" },
      { enabled: true, notificationType: "citizen.born" },
    ]);
  });

  it("rolls back the optimistic update when the request fails", async () => {
    const upsert = vi.fn().mockResolvedValue({
      error: { code: "42501", message: "permission denied" },
    });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const queryKey = notificationQueryKeys.preferences(USER_ID);
    const initialPreferences: readonly NotificationPreference[] = [
      { enabled: true, notificationType: "turn.completed" },
    ];
    queryClient.setQueryData(queryKey, initialPreferences);

    await expect(
      executeMutation(
        queryClient,
        setNotificationPreferenceMutationOptions({ client, queryClient }),
        { enabled: false, notificationType: "turn.completed", userId: USER_ID },
      ),
    ).rejects.toBeInstanceOf(AuthUiError);

    expect(
      queryClient.getQueryData<readonly NotificationPreference[]>(queryKey),
    ).toEqual(initialPreferences);
  });

  it("invalidates notification queries once the request settles", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upsert }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await executeMutation(
      queryClient,
      setNotificationPreferenceMutationOptions({ client, queryClient }),
      { enabled: false, notificationType: "turn.completed", userId: USER_ID },
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: notificationQueryKeys.all,
    });
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
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
