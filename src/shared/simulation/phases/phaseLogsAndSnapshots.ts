// Phase: logs and snapshots — stub filled by #B23.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationContext,
  SimulationLogEntry,
} from "../simulationTypes.ts";

export type PhaseLogsAndSnapshotsOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

export function phaseLogsAndSnapshots(
  _context: SimulationContext,
): PhaseLogsAndSnapshotsOutput {
  return { logs: [] };
}
