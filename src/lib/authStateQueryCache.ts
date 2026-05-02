import type { Session } from "@supabase/supabase-js";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const authStateQueryCacheKeys = {
  authAll: ["auth"] as const,
  calendarAll: ["calendar"] as const,
  currentAppUser: () =>
    [...authStateQueryCacheKeys.authAll, "current-app-user"] as const,
  currentSession: () =>
    [...authStateQueryCacheKeys.authAll, "current-session"] as const,
  permissionsAll: ["permissions"] as const,
  settlementsAll: ["settlements"] as const,
  worldAccessAll: ["world-access"] as const,
  worldsAll: ["worlds"] as const,
} as const;

const authDependentQueryKeys = [
  authStateQueryCacheKeys.currentAppUser(),
  authStateQueryCacheKeys.calendarAll,
  authStateQueryCacheKeys.permissionsAll,
  authStateQueryCacheKeys.settlementsAll,
  authStateQueryCacheKeys.worldAccessAll,
  authStateQueryCacheKeys.worldsAll,
] as const satisfies readonly QueryKey[];

export function syncAuthStateQueryCache(
  queryClient: QueryClient,
  session: Session | null,
): void {
  queryClient.setQueryData(authStateQueryCacheKeys.currentSession(), session);

  for (const queryKey of authDependentQueryKeys) {
    queryClient.removeQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function scheduleAuthStateQueryCacheSync(
  queryClient: QueryClient,
  session: Session | null,
): void {
  globalThis.setTimeout(() => {
    syncAuthStateQueryCache(queryClient, session);
  }, 0);
}
