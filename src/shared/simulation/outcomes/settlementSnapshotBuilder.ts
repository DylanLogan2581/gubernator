// Settlement snapshot builder stub — filled by subsequent issues.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SimulationContext } from "../simulationTypes.ts";

export type SettlementSnapshot = {
  readonly settlementId: string;
  readonly turnNumber: number;
};

export function buildSettlementSnapshot(
  context: SimulationContext,
): SettlementSnapshot {
  return {
    settlementId: context.input.settlementId,
    turnNumber: context.input.turnNumber,
  };
}
