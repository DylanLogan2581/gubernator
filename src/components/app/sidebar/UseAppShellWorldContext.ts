import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  createAccessContext,
  currentAccessContextQueryOptions,
  type AccessContext,
} from "@/features/permissions";
import {
  clearLastWorldPin,
  isWorldNotFoundError,
  readLastWorldPin,
  worldRouteAccessQueryOptions,
  writeLastWorldPin,
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
  readonly sidebarCanAdmin: boolean;
  readonly sidebarTurnLabel: string | null;
  readonly sidebarWorldId: string | null;
  readonly sidebarWorldName: string | null;
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

  // Sidebar-only fallback: world-less routes (Notifications, Superadmin)
  // otherwise lose all world context and collapse the sidebar to its
  // reduced out-of-world state. Falls back to the last world the viewer
  // visited (localStorage, no server tracking) so the sidebar stays sticky;
  // everything outside the sidebar (header, command palette) keeps using
  // `worldId` above, which stays route-only on purpose.
  const lastWorldId = routeWorldId === undefined ? readLastWorldPin() : null;
  const sidebarWorldId = worldId ?? lastWorldId;
  const isSidebarWorldFallback = worldId === null && sidebarWorldId !== null;

  useEffect(() => {
    if (routeWorldId !== undefined) {
      writeLastWorldPin(routeWorldId);
    }
  }, [routeWorldId]);

  const sidebarAccessQuery = useQuery({
    ...worldRouteAccessQueryOptions(sidebarWorldId ?? "", accessContext),
    enabled: sidebarWorldId !== null && accessContextQuery.data !== undefined,
  });

  // A stored world id can go stale (world deleted, access revoked). Once the
  // fallback lookup confirms that, clear the pin so the next world-less
  // visit doesn't retry it, and drop back to the reduced sidebar this render
  // rather than waiting a tick for the effect to land.
  const isSidebarWorldInvalid =
    isSidebarWorldFallback &&
    sidebarAccessQuery.isError &&
    isWorldNotFoundError(sidebarAccessQuery.error);

  useEffect(() => {
    if (isSidebarWorldInvalid) {
      clearLastWorldPin();
    }
  }, [isSidebarWorldInvalid]);

  const resolvedSidebarWorldId = isSidebarWorldInvalid ? null : sidebarWorldId;
  const sidebarWorldAccess =
    resolvedSidebarWorldId === null ? null : (sidebarAccessQuery.data ?? null);

  return {
    canAdmin: worldAccess?.canAdmin ?? false,
    isAuthenticated: accessContext.isAuthenticated,
    isSuperAdmin: accessContext.isSuperAdmin,
    isWorldPending:
      worldId !== null &&
      (accessContextQuery.isPending || worldAccessQuery.isPending),
    sidebarCanAdmin: sidebarWorldAccess?.canAdmin ?? false,
    sidebarTurnLabel:
      sidebarWorldAccess === null
        ? null
        : `Turn ${sidebarWorldAccess.header.currentTurnNumber} · ${sidebarWorldAccess.header.inWorldDateLabelShort}`,
    sidebarWorldId: resolvedSidebarWorldId,
    sidebarWorldName: sidebarWorldAccess?.header.name ?? null,
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
