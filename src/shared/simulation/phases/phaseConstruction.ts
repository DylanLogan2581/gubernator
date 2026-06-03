// Phase: construction — stub filled by #B13.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhaseConstructionOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
};

export function phaseConstruction(
  _context: SimulationContext,
): PhaseConstructionOutput {
  return { logs: [], notifications: [] };
}
