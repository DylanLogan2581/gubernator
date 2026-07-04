import { type JSX, type ReactNode } from "react";

import { ActivePlayerCharacterProvider } from "@/features/permissions";

import { useAppShellWorldContext } from "./UseAppShellWorldContext";

type AppShellProvidersProps = {
  readonly children: ReactNode;
};

// Mounts ActivePlayerCharacterProvider above both the sidebar and the routed
// page content whenever a world is in scope, so the sidebar's character card
// and admin gating share the exact same active-PC state as the page — this
// used to be mounted deeper (inside WorldEntryGate), wrapping only the page.
export function AppShellProviders({
  children,
}: AppShellProvidersProps): JSX.Element {
  const { userId, worldId } = useAppShellWorldContext();

  if (worldId === null) {
    return <>{children}</>;
  }

  return (
    <ActivePlayerCharacterProvider userId={userId} worldId={worldId}>
      {children}
    </ActivePlayerCharacterProvider>
  );
}
