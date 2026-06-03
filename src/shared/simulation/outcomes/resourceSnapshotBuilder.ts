// Resource snapshot builder stub — filled by subsequent issues.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SimulationContext } from "../simulationTypes.ts";

export type ResourceSnapshot = {
  readonly quantity: number;
  readonly resourceId: string;
  readonly settlementId: string;
  readonly turnNumber: number;
};

export function buildResourceSnapshots(
  _context: SimulationContext,
): readonly ResourceSnapshot[] {
  return [];
}
