import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Database } from "@/types/database";

import { notificationQueryKeys } from "../queries/notificationQueryKeys";

import type { NotificationPreference } from "../queries/notificationPreferencesQueries";

export type SetNotificationPreferenceInput = {
  readonly enabled: boolean;
  readonly notificationType: Database["public"]["Enums"]["notification_type"];
  readonly userId: string;
};

type SetNotificationPreferenceContext = {
  readonly previousPreferences: readonly NotificationPreference[] | undefined;
};

type SetNotificationPreferenceMutationOptions = UseMutationOptions<
  void,
  AuthUiError,
  SetNotificationPreferenceInput,
  SetNotificationPreferenceContext
>;

/**
 * Toggles a single notification type's preference with an optimistic cache
 * patch (the settings Sheet flips its Switch immediately) and rolls back on
 * failure. Re-enabling a type (the default) deletes its row instead of
 * writing enabled=true, so notification_preferences only ever holds
 * non-default rows.
 */
export function setNotificationPreferenceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNotificationPreferenceMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNotificationPreferenceInput) =>
      setNotificationPreference(client, input),
    onError: (_error, input, context) => {
      if (context === undefined) {
        return;
      }

      queryClient.setQueryData(
        notificationQueryKeys.preferences(input.userId),
        context.previousPreferences,
      );
    },
    onMutate: async (input) => {
      const queryKey = notificationQueryKeys.preferences(input.userId);
      await queryClient.cancelQueries({ queryKey });

      const previousPreferences =
        queryClient.getQueryData<readonly NotificationPreference[]>(queryKey);

      queryClient.setQueryData<readonly NotificationPreference[]>(
        queryKey,
        (current) =>
          current?.map((preference) =>
            preference.notificationType === input.notificationType
              ? { ...preference, enabled: input.enabled }
              : preference,
          ),
      );

      return { previousPreferences };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
    },
  });
}

async function setNotificationPreference(
  client: GubernatorSupabaseClient,
  input: SetNotificationPreferenceInput,
): Promise<void> {
  if (input.enabled) {
    const { error } = await client
      .from("notification_preferences")
      .delete()
      .eq("user_id", input.userId)
      .eq("notification_type", input.notificationType);

    if (error !== null) {
      throw normalizeSupabaseError(error);
    }
    return;
  }

  const { error } = await client.from("notification_preferences").upsert(
    {
      enabled: false,
      notification_type: input.notificationType,
      user_id: input.userId,
    },
    { onConflict: "user_id,notification_type" },
  );

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
