import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { JSX, ReactNode } from "react";

export function CultureDetailFrame({
  children,
  worldId,
}: {
  readonly children: ReactNode;
  readonly worldId: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link
          to="/worlds/$worldId/configuration"
          params={{ worldId }}
          search={{ tab: "cultures" }}
        >
          <ArrowLeft aria-hidden="true" />
          Back to cultures
        </Link>
      </Button>
      {children}
    </div>
  );
}
