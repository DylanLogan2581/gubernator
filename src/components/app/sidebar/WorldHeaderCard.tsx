import { SidebarHeader } from "@/components/ui/sidebar";
import { WorldSwitcher } from "@/features/worlds";

import type { JSX } from "react";

type WorldHeaderCardProps = {
  readonly turnLabel: string | null;
  readonly worldId: string | null;
  readonly worldName: string | null;
};

// World identity + switcher dropdown (sidebar-07 team-switcher pattern, see
// docs/ui-redesign.md §3.2). WorldSwitcher shows a "Select a world"
// placeholder for out-of-world routes (/worlds, /superadmin, /notifications).
export function WorldHeaderCard({
  turnLabel,
  worldId,
  worldName,
}: WorldHeaderCardProps): JSX.Element {
  return (
    <SidebarHeader>
      <WorldSwitcher
        turnLabel={turnLabel}
        worldId={worldId}
        worldName={worldName}
      />
    </SidebarHeader>
  );
}
