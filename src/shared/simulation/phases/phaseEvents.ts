// Phase: events — stub filled by #B21.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhaseEventsOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
};

export function phaseEvents(_context: SimulationContext): PhaseEventsOutput {
  return { logs: [], notifications: [] };
}
