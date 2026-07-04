import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { markAllNotificationsReadMutationOptions } from "../queries/notificationQueries";
import { notificationQueryKeys } from "../queries/notificationQueryKeys";

type UseMarkAllNotificationsReadResult = {
  readonly handleMarkAllRead: () => void;
  readonly isPending: boolean;
};

/**
 * Shared "mark all as read" handler used by both the header notifications
 * popover and the full notifications page, so the mutation + cache
 * invalidation logic lives in one place.
 */
export function useMarkAllNotificationsRead(
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseMarkAllNotificationsReadResult {
  const queryClient = useQueryClient();
  const markAllReadMutation = useMutation(
    markAllNotificationsReadMutationOptions(client),
  );

  const handleMarkAllRead = (): void => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: notificationQueryKeys.all,
        });
      },
    });
  };

  return { handleMarkAllRead, isPending: markAllReadMutation.isPending };
}
