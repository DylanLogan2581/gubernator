import { Inbox } from "lucide-react";
import { type ComponentType, type JSX, type ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
};

export function EmptyState({
  title,
  description,
  action,
  icon = Inbox,
}: EmptyStateProps): JSX.Element {
  const Icon = icon;
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center"
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description !== undefined ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action !== undefined ? <div>{action}</div> : null}
    </div>
  );
}
