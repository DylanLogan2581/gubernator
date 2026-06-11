import { Globe2 } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { WorldBreadcrumb } from "./WorldBreadcrumb";

type WorldContextBarProps = {
  readonly children?: ReactNode;
  readonly worldId: string;
  readonly worldName: string;
};

export function WorldContextBar({
  children,
  worldId,
  worldName,
}: WorldContextBarProps): JSX.Element {
  return (
    <div
      aria-label="Active world context"
      className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Globe2 className="size-3.5 shrink-0" aria-hidden="true" />
        <WorldBreadcrumb worldId={worldId} worldName={worldName} />
      </div>
      {children}
    </div>
  );
}
