// Phase: deposit extraction — stub filled by #B12.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
} from "../simulationTypes.ts";

export type PhaseDepositExtractionOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

export function phaseDepositExtraction(
  _context: SimulationContext,
): PhaseDepositExtractionOutput {
  return { logs: [] };
}
