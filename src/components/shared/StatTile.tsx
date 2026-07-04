import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

type StatTileTone = "default" | "success" | "warning";

const TONE_CHIP_CLASSES: Record<StatTileTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
};

type StatTileProps = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: ReactNode;
  readonly context?: ReactNode;
  readonly tone?: StatTileTone;
  readonly isLoading?: boolean;
};

/**
 * Compact dashboard tile: icon chip, value, one-line context.
 * Purely presentational — callers own querying, loading state, and tone.
 */
export function StatTile({
  icon,
  label,
  value,
  context,
  tone = "default",
  isLoading = false,
}: StatTileProps): JSX.Element {
  const Icon = icon;

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            TONE_CHIP_CLASSES[tone],
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-2xl leading-none font-semibold">{value}</p>
          )}
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-3 w-28" />
      ) : context !== undefined ? (
        <p className="truncate text-xs text-muted-foreground">{context}</p>
      ) : null}
    </Card>
  );
}
