// Phase: citizen consumption — stub filled by #B18.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
} from "../simulationTypes.ts";

export type PhaseCitizenConsumptionOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

export function phaseCitizenConsumption(
  _context: SimulationContext,
): PhaseCitizenConsumptionOutput {
  return { logs: [] };
}
