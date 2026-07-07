import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";
import { Constants } from "@/types/database";

import { notificationPreferencesQueryOptions } from "./notificationPreferencesQueries";

describe("notificationPreferencesQueryOptions", () => {
  it("returns every notification type enabled by default when no rows exist", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();

    const preferences = await queryClient.fetchQuery(
      notificationPreferencesQueryOptions("user-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(preferences).toHaveLength(
      Constants.public.Enums.notification_type.length,
    );
    expect(preferences.every((preference) => preference.enabled)).toBe(true);
    expect(from).toHaveBeenCalledWith("notification_preferences");
    expect(select).toHaveBeenCalledWith("notification_type,enabled");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("marks a muted type as disabled and leaves the rest enabled", async () => {
    const mutedType = Constants.public.Enums.notification_type[0];
    const eq = vi.fn().mockResolvedValue({
      data: [{ enabled: false, notification_type: mutedType }],
      error: null,
    });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();

    const preferences = await queryClient.fetchQuery(
      notificationPreferencesQueryOptions("user-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    const mutedPreference = preferences.find(
      (preference) => preference.notificationType === mutedType,
    );
    const otherPreferences = preferences.filter(
      (preference) => preference.notificationType !== mutedType,
    );

    expect(mutedPreference?.enabled).toBe(false);
    expect(otherPreferences.every((preference) => preference.enabled)).toBe(
      true,
    );
  });

  it("returns an empty list when userId is null", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();

    const preferences = await queryClient.fetchQuery(
      notificationPreferencesQueryOptions(null, client),
    );

    expect(preferences).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("normalizes Supabase errors", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table notification_preferences",
      },
    });
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        notificationPreferencesQueryOptions("user-1", {
          from,
        } as unknown as GubernatorSupabaseClient),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      name: "AuthUiError",
    });
  });

  it("uses a user-scoped query key", () => {
    const options = notificationPreferencesQueryOptions(
      "user-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "notifications",
      "preferences",
      "user-1",
    ]);
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
