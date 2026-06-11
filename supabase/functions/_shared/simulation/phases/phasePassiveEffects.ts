// Phase: passive effects — applies passive_resource_production effects from
// each active building's tier, producing stockpile deltas.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SimulationContext, SimulationLogEntry, StockpileDelta } from "../simulationTypes.ts";

export type PhasePassiveEffectsOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

export function phasePassiveEffects(
  context: SimulationContext,
): PhasePassiveEffectsOutput {
  const { buildingTiers, settlementBuildings } = context.input;

  const tierById = new Map(buildingTiers.map((t) => [t.id, t]));

  const allLogs: SimulationLogEntry[] = [];
  const allDeltas: StockpileDelta[] = [];

  for (const building of settlementBuildings) {
    if (building.state !== "active") continue;

    const tier = tierById.get(building.currentTierId);
    if (tier === undefined) continue;

    for (const effect of tier.effectsJson) {
      if (effect.type !== "passive_resource_production") continue;

      allDeltas.push({
        delta: effect.amount,
        resourceId: effect.resourceId,
        settlementId: building.settlementId,
      });

      allLogs.push({
        category: "passive_effect.applied",
        payload: {
          amount: effect.amount,
          buildingId: building.id,
          resourceId: effect.resourceId,
          settlementId: building.settlementId,
          tierId: tier.id,
        },
        phase: "passiveEffects",
      });
    }
  }

  return { logs: allLogs, stockpileDeltas: allDeltas };
}
