// Simulation orchestrator stub — filled by #B24.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SimulationInput, SimulationOutput } from "./simulationTypes.ts";

export function runSimulation(input: SimulationInput): SimulationOutput {
  return {
    logs: [],
    notifications: [],
    settlementId: input.settlementId,
    turnNumber: input.turnNumber,
  };
}
