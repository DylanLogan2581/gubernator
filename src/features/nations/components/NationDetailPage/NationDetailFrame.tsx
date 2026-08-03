import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { DetailPageFrame } from "@/components/shared/DetailPageFrame";

import type { JSX, ReactNode } from "react";

export function NationDetailFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <DetailPageFrame
      backButtonClassName="print:hidden"
      backLink={
        <Link to="/worlds/$worldId/nations" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to nations
        </Link>
      }
    >
      {children}
    </DetailPageFrame>
  );
}
