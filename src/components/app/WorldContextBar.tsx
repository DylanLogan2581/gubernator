import { Globe2 } from "lucide-react";
import { type JSX, type ReactNode } from "react";

type WorldContextBarProps = {
  readonly children?: ReactNode;
};

// World-scope context strip rendered at the top of the world layout. Provides
// a visual container that callers fill with world/turn/calendar/character
// controls; this component itself is purely structural so it can live in the
// app-component layer without depending on features.
export function WorldContextBar({
  children,
}: WorldContextBarProps): JSX.Element {
  return (
    <div
      aria-label="Active world context"
      className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Globe2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Active world</span>
      </div>
      {children}
    </div>
  );
}
