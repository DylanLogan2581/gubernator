import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { JSX, ReactNode } from "react";

export function NationDetailFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-fit print:hidden"
      >
        <Link to="/worlds/$worldId/nations" params={{ worldId }}>
          <ArrowLeft aria-hidden="true" />
          Back to nations
        </Link>
      </Button>
      {children}
    </div>
  );
}
