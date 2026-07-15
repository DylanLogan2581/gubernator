import type { LucideIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

type PageHeaderProps = {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
};

// Canonical top-level page header: icon + title (+ optional description) on
// the left, right-aligned actions slot. One size across every top-level page.
export function PageHeader({
  icon,
  title,
  description,
  actions,
}: PageHeaderProps): JSX.Element {
  const Icon = icon;
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {Icon !== undefined ? (
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{title}</h1>
          {description !== undefined ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions !== undefined ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
