import { type JSX, type ReactNode } from "react";

import { ActivePlayerCharacterProvider } from "@/features/permissions";

import { useAppShellWorldContext } from "./UseAppShellWorldContext";
import { WorldScopeProvider } from "./WorldScopeProvider";

type AppShellProvidersProps = {
  readonly children: ReactNode;
};

// Mounts ActivePlayerCharacterProvider + WorldScopeProvider above both the
// sidebar and the routed page content whenever a world is in scope, so the
// sidebar's character card / SETTLEMENT-NATION switchers and admin gating
// share the exact same state as the page — ActivePlayerCharacterProvider
// used to be mounted deeper (inside WorldEntryGate), wrapping only the page.
// WorldScopeProvider is nested inside it because its home-settlement
// fallback tier reads the active character.
export function AppShellProviders({
  children,
}: AppShellProvidersProps): JSX.Element {
  // Keyed off the sidebar's fallback-aware world id (not the route-only
  // `worldId`) so the character card / scope switchers stay populated on
  // world-less routes (Notifications, Superadmin) when a last-visited world
  // is on record — see UseAppShellWorldContext's sidebarWorldId.
  const { sidebarWorldId, userId } = useAppShellWorldContext();

  if (sidebarWorldId === null) {
    return <>{children}</>;
  }

  return (
    <ActivePlayerCharacterProvider userId={userId} worldId={sidebarWorldId}>
      <WorldScopeProvider worldId={sidebarWorldId}>
        {children}
      </WorldScopeProvider>
    </ActivePlayerCharacterProvider>
  );
}
