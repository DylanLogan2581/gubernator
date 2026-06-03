// Phase: passive effects — stub filled by #B15.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
} from "../simulationTypes.ts";

export type PhasePassiveEffectsOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

export function phasePassiveEffects(
  _context: SimulationContext,
): PhasePassiveEffectsOutput {
  return { logs: [] };
}
