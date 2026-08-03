import type { JSX, ReactNode } from "react";

type DetailPageHeaderProps = {
  /**
   * Seal/flag block for the entity (rendered at ~64px). Optional so callers
   * without imagery still get the letterhead treatment.
   */
  readonly media?: ReactNode;
  readonly title: string;
  /** Breadcrumb-style context line beneath the name. */
  readonly context?: ReactNode;
  readonly actions?: ReactNode;
};

/**
 * Letterhead header for entity detail pages (nations, settlements): the
 * seal/flag beside the name set in the display face, a breadcrumb-style
 * context line, right-aligned actions, and the same thin-over-thick double
 * rule that closes the top-level `PageHeader`.
 */
export function DetailPageHeader({
  media,
  title,
  context,
  actions,
}: DetailPageHeaderProps): JSX.Element {
  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {media}
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-2xl leading-tight tracking-normal break-words">
              {title}
            </h1>
            {context !== undefined ? (
              <p className="text-sm text-muted-foreground">{context}</p>
            ) : null}
          </div>
        </div>
        {actions !== undefined ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <hr className="rule-double" />
    </header>
  );
}
