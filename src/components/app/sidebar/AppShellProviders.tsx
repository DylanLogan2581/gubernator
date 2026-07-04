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
  const { userId, worldId } = useAppShellWorldContext();

  if (worldId === null) {
    return <>{children}</>;
  }

  return (
    <ActivePlayerCharacterProvider userId={userId} worldId={worldId}>
      <WorldScopeProvider worldId={worldId}>{children}</WorldScopeProvider>
    </ActivePlayerCharacterProvider>
  );
}
