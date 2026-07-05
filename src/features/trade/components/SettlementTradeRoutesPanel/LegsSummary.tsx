import type { TradeRouteLeg } from "../../types/tradeRouteTypes";
import type { JSX } from "react";

export function LegsSummary({
  legs,
  viewerSide,
}: {
  readonly legs: readonly TradeRouteLeg[];
  readonly viewerSide: "destination" | "origin";
}): JSX.Element {
  if (legs.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const items = legs.map((leg) => {
    // From the viewer's perspective:
    // - origin viewer: "send" legs are negative (outgoing), "receive" legs are positive (incoming)
    // - destination viewer: "send" legs are positive (incoming), "receive" legs are negative (outgoing)
    const isNegative =
      (viewerSide === "origin" && leg.direction === "send") ||
      (viewerSide === "destination" && leg.direction === "receive");
    const sign = isNegative ? "−" : "+";
    const colorClass = isNegative
      ? "text-destructive"
      : "text-success-foreground";
    return { colorClass, leg, sign };
  });

  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs tabular-nums">
      {items.map(({ colorClass, leg, sign }) => (
        <span key={leg.id} className={`font-medium ${colorClass}`}>
          {sign}
          {leg.quantityPerTransition.toLocaleString()} {leg.resourceName}
        </span>
      ))}
    </span>
  );
}
