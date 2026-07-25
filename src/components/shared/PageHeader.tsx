import type { LucideIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

type PageHeaderProps = {
  readonly icon?: LucideIcon;
  readonly eyebrow?: ReactNode;
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
};

// Canonical top-level page header, styled as a letterhead: an optional
// small-caps eyebrow, the title set in the display face, an optional
// description, right-aligned actions, and a full-width thin-over-thick double
// rule closing the header. One size across every top-level page.
export function PageHeader({
  icon,
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps): JSX.Element {
  const Icon = icon;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon !== undefined ? (
            <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
          ) : null}
          <div className="min-w-0">
            {eyebrow !== undefined ? (
              <p className="eyebrow mb-1">{eyebrow}</p>
            ) : null}
            <h1 className="font-display text-2xl leading-tight tracking-normal break-words">
              {title}
            </h1>
            {description !== undefined ? (
              <p className="text-sm text-muted-foreground">{description}</p>
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
