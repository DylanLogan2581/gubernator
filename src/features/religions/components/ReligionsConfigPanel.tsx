import { LoreEntityConfigPanel } from "@/features/worlds";

import { religionDescriptor } from "./ReligionDescriptor";

import type { JSX } from "react";

type ReligionsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ReligionsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ReligionsConfigPanelProps): JSX.Element {
  return (
    <LoreEntityConfigPanel
      canAdmin={canAdmin}
      descriptor={religionDescriptor}
      isArchived={isArchived}
      worldId={worldId}
    />
  );
}
