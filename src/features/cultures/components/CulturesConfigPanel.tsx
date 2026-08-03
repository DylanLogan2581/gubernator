import { LoreEntityConfigPanel } from "@/features/worlds";

import { cultureDescriptor } from "./CultureDescriptor";

import type { JSX } from "react";

type CulturesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function CulturesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: CulturesConfigPanelProps): JSX.Element {
  return (
    <LoreEntityConfigPanel
      canAdmin={canAdmin}
      descriptor={cultureDescriptor}
      isArchived={isArchived}
      worldId={worldId}
    />
  );
}
