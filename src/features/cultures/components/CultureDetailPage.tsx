import { LoreEntityDetailPage } from "@/features/worlds";

import { cultureDescriptor } from "./CultureDescriptor";

import type { JSX } from "react";

type CultureDetailPageProps = {
  readonly cultureId: string;
  readonly worldId: string;
};

export function CultureDetailPage({
  cultureId,
  worldId,
}: CultureDetailPageProps): JSX.Element {
  return (
    <LoreEntityDetailPage
      descriptor={cultureDescriptor}
      entityId={cultureId}
      worldId={worldId}
    />
  );
}
