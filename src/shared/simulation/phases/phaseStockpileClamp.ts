// Phase: stockpile clamp — stub filled by #B22.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
} from "../simulationTypes.ts";

export type PhaseStockpileClampOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

export function phaseStockpileClamp(
  _context: SimulationContext,
): PhaseStockpileClampOutput {
  return { logs: [] };
}
