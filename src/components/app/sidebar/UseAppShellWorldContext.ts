import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import {
  createAccessContext,
  currentAccessContextQueryOptions,
  type AccessContext,
} from "@/features/permissions";
import {
  worldRouteAccessQueryOptions,
  type WorldRouteAccess,
} from "@/features/worlds";

// Placeholder used only until the real access context resolves (or when
// unauthenticated) so worldRouteAccessQueryOptions always has a context to
// build a query key from — the query itself stays disabled until real data
// is in.
const PENDING_ACCESS_CONTEXT: AccessContext = createAccessContext({
  isSuperAdmin: false,
  userId: null,
  worldAdminWorldIds: [],
});

export type AppShellWorldContext = {
  readonly canAdmin: boolean;
  readonly isAuthenticated: boolean;
  readonly isSuperAdmin: boolean;
  readonly isWorldPending: boolean;
  readonly turnLabel: string | null;
  readonly userId: string | null;
  readonly worldAccess: WorldRouteAccess | null;
  readonly worldId: string | null;
  readonly worldName: string | null;
};

// Route-params + react-query driven world/permission context for the app
// shell (sidebar + header). Safe to call from anywhere under the router and
// query client — TanStack Router params aren't tree-position-scoped like
// React context, and react-query dedupes the underlying fetches against the
// same cache WorldEntryGate already populates.
export function useAppShellWorldContext(): AppShellWorldContext {
  const queryClient = useQueryClient();
  const { worldId: routeWorldId } = useParams({ strict: false });
  const worldId = routeWorldId ?? null;

  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );
  const accessContext = accessContextQuery.data ?? PENDING_ACCESS_CONTEXT;

  const worldAccessQuery = useQuery({
    ...worldRouteAccessQueryOptions(worldId ?? "", accessContext),
    enabled: worldId !== null && accessContextQuery.data !== undefined,
  });

  const worldAccess = worldId === null ? null : (worldAccessQuery.data ?? null);

  return {
    canAdmin: worldAccess?.canAdmin ?? false,
    isAuthenticated: accessContext.isAuthenticated,
    isSuperAdmin: accessContext.isSuperAdmin,
    isWorldPending:
      worldId !== null &&
      (accessContextQuery.isPending || worldAccessQuery.isPending),
    turnLabel:
      worldAccess === null
        ? null
        : `Turn ${worldAccess.header.currentTurnNumber} · ${worldAccess.header.inWorldDateLabelShort}`,
    userId: accessContext.userId,
    worldAccess,
    worldId,
    worldName: worldAccess?.header.name ?? null,
  };
}
