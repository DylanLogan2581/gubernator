import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { DetailPageFrame } from "@/components/shared/DetailPageFrame";

import type { JSX, ReactNode } from "react";

type SettlementNav = {
  readonly nationId: string;
  readonly settlementId: string;
  readonly settlementName: string;
};

export function CitizenDetailFrame({
  children,
  settlementNav = null,
  worldId,
}: {
  readonly children: ReactNode;
  readonly settlementNav?: SettlementNav | null;
  readonly worldId: string;
}): JSX.Element {
  return (
    <DetailPageFrame
      backLink={
        settlementNav !== null ? (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
            params={{
              nationId: settlementNav.nationId,
              settlementId: settlementNav.settlementId,
              worldId,
            }}
          >
            <ArrowLeft aria-hidden="true" />
            Back to {settlementNav.settlementName}
          </Link>
        ) : (
          <Link to="/worlds/$worldId" params={{ worldId }}>
            <ArrowLeft aria-hidden="true" />
            Back to world
          </Link>
        )
      }
    >
      {children}
    </DetailPageFrame>
  );
}
