import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

type StatTileTone = "default" | "success" | "warning" | "destructive";

type StatTileProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: ReactNode;
  readonly context?: ReactNode;
  readonly tone?: StatTileTone;
  readonly isLoading?: boolean;
  readonly children?: ReactNode;
};

const TONE_VALUE_CLASSNAMES: Record<StatTileTone, string> = {
  default: "text-foreground",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
};

/**
 * Ledger-style stat figure: a small-caps eyebrow label above a big figure set
 * in the figures font with tabular numerals (so figures align across the
 * strip), an optional one-line context, and an optional trailing slot for
 * interactive controls. Purely presentational — callers own querying, loading
 * state, and tone. Meant to sit inside a `StatStrip`, not a card.
 */
export function StatTile({
  icon,
  label,
  value,
  context,
  tone = "default",
  isLoading = false,
  children,
}: StatTileProps): JSX.Element {
  const Icon = icon;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="eyebrow flex items-center gap-1.5">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <span
          className={cn(
            "font-mono text-2xl leading-none font-semibold tabular-nums break-words",
            TONE_VALUE_CLASSNAMES[tone],
          )}
        >
          {value}
        </span>
      )}
      {isLoading ? (
        <Skeleton className="h-3 w-28" />
      ) : context !== undefined ? (
        <span className="text-xs text-muted-foreground">{context}</span>
      ) : null}
      {!isLoading && children !== undefined ? children : null}
    </div>
  );
}
