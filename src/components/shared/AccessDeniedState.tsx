import { ShieldAlert } from "lucide-react";
import { useId, type JSX, type ReactNode } from "react";

type AccessDeniedStateProps = {
  readonly title?: string;
  readonly description?: string;
  readonly action?: ReactNode;
};

export function AccessDeniedState({
  title = "Access denied",
  description = "Your Gubernator account does not have access to this area.",
  action,
}: AccessDeniedStateProps): JSX.Element {
  const headingId = useId();
  const descriptionId = useId();

  return (
    <section
      role="status"
      aria-labelledby={headingId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center"
    >
      <ShieldAlert
        className="size-8 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <h2 id={headingId} className="text-sm font-medium">
          {title}
        </h2>
        {description !== undefined ? (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action !== undefined ? <div>{action}</div> : null}
    </section>
  );
}
