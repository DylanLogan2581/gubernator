import { TriangleAlert } from "lucide-react";
import { type JSX, type ReactNode } from "react";

type ErrorStateProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
};

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: ErrorStateProps): JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center"
    >
      <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
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
