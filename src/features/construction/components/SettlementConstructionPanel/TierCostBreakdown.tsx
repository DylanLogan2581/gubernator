import { type JSX } from "react";

import type { BuildingBlueprintTier } from "@/features/buildings";
import { cn } from "@/lib/utils";

/**
 * Segmented, per-tier construction-cost breakdown (#1372). Renders one segment
 * per tier from 1 up to the target tier so it is visually clear that a
 * direct-build to tier N stacks the costs of tiers 1..N — and that upgrading an
 * existing tier-M building only charges the tiers above M. Tiers at or below
 * `fromTierNumber` are shown dimmed as "already built"; the remaining tiers are
 * the ones actually charged.
 */
export function TierCostBreakdown({
  fromTierNumber,
  resourceNames,
  targetTierNumber,
  tiers,
}: {
  readonly fromTierNumber: number;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly targetTierNumber: number;
  readonly tiers: readonly BuildingBlueprintTier[];
}): JSX.Element {
  const orderedTiers = [...tiers]
    .filter((t) => t.tierNumber <= targetTierNumber)
    .sort((a, b) => a.tierNumber - b.tierNumber);

  // Sum the charged tiers (those above the building's current tier) per resource.
  const chargedTotals = new Map<string, number>();
  for (const tier of orderedTiers) {
    if (tier.tierNumber <= fromTierNumber) continue;
    for (const cost of tier.constructionCostsJson) {
      chargedTotals.set(
        cost.resourceId,
        (chargedTotals.get(cost.resourceId) ?? 0) + cost.amount,
      );
    }
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">Construction cost breakdown</p>
      <ul className="grid gap-1">
        {orderedTiers.map((tier) => {
          const alreadyBuilt = tier.tierNumber <= fromTierNumber;
          return (
            <li
              key={tier.id}
              className={cn(
                "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border px-2 py-1 text-sm",
                alreadyBuilt
                  ? "border-dashed border-border text-muted-foreground"
                  : "border-border",
              )}
            >
              <span className="font-medium">Tier {tier.tierNumber}</span>
              {alreadyBuilt ? (
                <span className="text-xs uppercase tracking-wide">
                  already built
                </span>
              ) : null}
              <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                {tier.constructionCostsJson.length > 0 ? (
                  tier.constructionCostsJson.map((cost) => (
                    <span key={cost.resourceId}>
                      {resourceNames.get(cost.resourceId) ?? cost.resourceId}:{" "}
                      {cost.amount.toLocaleString()}/turn
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">
                    no resource cost
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {chargedTotals.size > 0 ? (
        <p className="text-sm text-muted-foreground">
          Charged per worker per turn:{" "}
          {[...chargedTotals]
            .map(
              ([resourceId, amount]) =>
                `${resourceNames.get(resourceId) ?? resourceId} ${amount.toLocaleString()}`,
            )
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}
