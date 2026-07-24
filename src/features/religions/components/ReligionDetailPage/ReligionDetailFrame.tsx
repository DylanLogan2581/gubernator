import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { DetailPageFrame } from "@/components/shared/DetailPageFrame";

import type { JSX, ReactNode } from "react";

export function ReligionDetailFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <DetailPageFrame
      backLink={
        <Link
          to="/worlds/$worldId/configuration"
          params={{ worldId }}
          search={{ tab: "religions" }}
        >
          <ArrowLeft aria-hidden="true" />
          Back to religions
        </Link>
      }
    >
      {children}
    </DetailPageFrame>
  );
}
