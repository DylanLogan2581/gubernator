import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type EventsPageFrameProps = {
  readonly worldId: string;
  readonly children: ReactNode;
};

export function EventsPageFrame({
  worldId,
  children,
}: EventsPageFrameProps): JSX.Element {
  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="w-fit">
          <Link to="/worlds/$worldId" params={{ worldId }}>
            <ArrowLeft aria-hidden="true" />
            Back to world
          </Link>
        </Button>
      </div>
      <main>{children}</main>
    </div>
  );
}
