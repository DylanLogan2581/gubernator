import { Loader2 } from "lucide-react";
import { type JSX } from "react";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({
  label = "Loading…",
}: LoadingStateProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground"
    >
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-xs">{label}</p>
    </div>
  );
}
