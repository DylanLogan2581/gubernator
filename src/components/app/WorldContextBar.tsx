import { Globe2 } from "lucide-react";
import { type JSX } from "react";

export function WorldContextBar(): JSX.Element {
  return (
    <div
      aria-label="Active world context"
      className="mb-2 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <Globe2 className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        No active world &mdash; world, turn, calendar, and character context
        will appear here
      </span>
    </div>
  );
}
