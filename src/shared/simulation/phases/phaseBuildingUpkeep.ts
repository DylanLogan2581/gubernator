// Phase: building upkeep — stub filled by #B14.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
} from "../simulationTypes.ts";

export type PhaseBuildingUpkeepOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

export function phaseBuildingUpkeep(
  _context: SimulationContext,
): PhaseBuildingUpkeepOutput {
  return { logs: [] };
}
