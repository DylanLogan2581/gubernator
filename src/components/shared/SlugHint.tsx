import type { JSX } from "react";

export function SlugHint({
  error,
  slug,
}: {
  readonly error?: string;
  readonly slug: string;
}): JSX.Element {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">
        slug: {slug !== "" ? slug : "…"}
      </p>
      {error !== undefined ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
