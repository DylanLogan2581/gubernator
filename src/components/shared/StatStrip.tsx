import { cn } from "@/lib/utils";

import type { JSX, ReactNode } from "react";

type StatStripProps = {
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * Ledger-style figures strip: lays stat figures out in a responsive grid
 * closed by a single hairline rule, with no per-figure boxes or backgrounds.
 *
 * Consumers pass the responsive column classes and, at the breakpoint where
 * the figures settle onto a single row, the `<bp>:divide-x` + padding
 * utilities that draw the thin vertical separators between them (below that
 * breakpoint the figures wrap to a gapped grid with no separators to collide).
 */
export function StatStrip({
  className,
  children,
}: StatStripProps): JSX.Element {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-5 border-b border-border pb-4 [&>*]:min-w-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
