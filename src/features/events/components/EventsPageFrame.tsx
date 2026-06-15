import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            void navigate({
              to: "/worlds/$worldId",
              params: { worldId },
            });
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back to world</span>
        </Button>
      </div>
      <main>{children}</main>
    </div>
  );
}
