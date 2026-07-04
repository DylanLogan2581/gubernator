import { ActiveCharacterSwitcher } from "@/features/permissions";

import type { JSX } from "react";

type CharacterCardProps = {
  readonly canAdmin: boolean;
  readonly worldId: string;
};

// Pinned character card below the world header — relocates the former
// header-bar ActiveCharacterSwitcher, unchanged, keeping its switch/clear/
// admin-paused semantics intact.
export function CharacterCard({
  canAdmin,
  worldId,
}: CharacterCardProps): JSX.Element {
  return (
    <div className="border-b border-sidebar-border px-2 py-2 group-data-[collapsible=icon]:hidden">
      <ActiveCharacterSwitcher canAdmin={canAdmin} worldId={worldId} />
    </div>
  );
}
