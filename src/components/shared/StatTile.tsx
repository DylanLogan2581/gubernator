import { IconChip } from "@/components/shared/IconChip";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
  children,
}: StatTileProps): JSX.Element {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center gap-3">
        <IconChip icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-base leading-tight font-semibold break-words sm:text-xl md:text-2xl">
              {value}
            </p>
          )}
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-3 w-28" />
      ) : context !== undefined ? (
        <p className="text-xs text-muted-foreground">{context}</p>
      ) : null}
      {!isLoading && children !== undefined ? children : null}
    </Card>
  );
}
