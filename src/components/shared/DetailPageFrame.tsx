import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { JSX, ReactNode } from "react";

type DetailPageFrameProps = {
  /**
   * The back link element (typically a TanStack Router `<Link>` containing an
   * `<ArrowLeft>` icon and label). Passed as a slot so callers keep fully
   * typed `to`/`params`/`search` props.
   */
  readonly backLink: ReactNode;
  readonly backButtonClassName?: string;
  readonly children: ReactNode;
};

/**
 * Common detail-page shell: an outline back-link button above the page
 * content. Callers own the link destination and label.
 */
export function DetailPageFrame({
  backLink,
  backButtonClassName,
  children,
}: DetailPageFrameProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Button
        asChild
        variant="outline"
        size="sm"
        className={cn("w-fit", backButtonClassName)}
      >
        {backLink}
      </Button>
      {children}
    </div>
  );
}
