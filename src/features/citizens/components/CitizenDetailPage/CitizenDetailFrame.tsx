import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

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
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        {settlementNav !== null ? (
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
        )}
      </Button>
      {children}
    </div>
  );
}
