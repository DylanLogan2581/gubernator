import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { notificationQueryKeys } from "../queries/notificationQueryKeys";

/**
 * Subscribes to Supabase Realtime for the notifications table scoped to the
 * current user. On any INSERT/UPDATE/DELETE, invalidates all notification
 * queries so passive recipients (nation/settlement managers) see new rows
 * without a manual refresh.
 *
 * Must be mounted in a component that persists across page navigation
 * (e.g. the app header) so the subscription stays alive.
 */
export function useNotificationsRealtime(
  userId: string | null,
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userId === null) return;

    const channel = client
      .channel(`notifications:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: notificationQueryKeys.all,
          });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client, queryClient, userId]);
}
