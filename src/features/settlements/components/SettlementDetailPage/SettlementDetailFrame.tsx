import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { DetailPageFrame } from "@/components/shared/DetailPageFrame";

import type { JSX, ReactNode } from "react";

export function SettlementDetailFrame({
  backLabel = "Back to nation",
  children,
  nationId,
  worldId,
}: {
  readonly backLabel?: string;
  readonly children: ReactNode;
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  return (
    <DetailPageFrame
      backLink={
        <Link
          to="/worlds/$worldId/nations/$nationId"
          params={{ nationId, worldId }}
        >
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Link>
      }
    >
      {children}
    </DetailPageFrame>
  );
}
