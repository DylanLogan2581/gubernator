import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

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
    <div className="mx-auto flex max-w-5xl flex-col gap-4 py-6">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link
          to="/worlds/$worldId/nations/$nationId"
          params={{ nationId, worldId }}
        >
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </Link>
      </Button>
      {children}
    </div>
  );
}
