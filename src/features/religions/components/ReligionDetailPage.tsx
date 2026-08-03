import { LoreEntityDetailPage } from "@/features/worlds";

import { religionDescriptor } from "./ReligionDescriptor";

import type { JSX } from "react";

type ReligionDetailPageProps = {
  readonly religionId: string;
  readonly worldId: string;
};

export function ReligionDetailPage({
  religionId,
  worldId,
}: ReligionDetailPageProps): JSX.Element {
  return (
    <LoreEntityDetailPage
      descriptor={religionDescriptor}
      entityId={religionId}
      worldId={worldId}
    />
  );
}
