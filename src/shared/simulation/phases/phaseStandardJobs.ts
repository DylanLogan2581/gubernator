// Phase: standard jobs — stub filled by #B11.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
} from "../simulationTypes.ts";

export type PhaseStandardJobsOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

export function phaseStandardJobs(
  _context: SimulationContext,
): PhaseStandardJobsOutput {
  return { logs: [] };
}
