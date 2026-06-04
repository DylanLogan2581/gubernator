// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { CitizenPatch, SimCitizen } from "../../simulationTypes.ts";

export function applyBornOnTurnNumberBackfill(
  citizens: readonly SimCitizen[],
  turnNumber: number,
  minimumPartnershipAgeTurns: number,
): { citizenById: Map<string, SimCitizen>; citizenPatches: CitizenPatch[] } {
  const citizenById = new Map(citizens.map((c) => [c.id, c]));
  const citizenPatches: CitizenPatch[] = [];
  for (const citizen of citizens) {
    if (citizen.bornOnTurnNumber === null) {
      const backfilledTurn = turnNumber - minimumPartnershipAgeTurns;
      citizenPatches.push({
        bornOnTurnNumber: backfilledTurn,
        citizenId: citizen.id,
      });
      citizenById.set(citizen.id, {
        ...citizen,
        bornOnTurnNumber: backfilledTurn,
      });
    }
  }
  return { citizenById, citizenPatches };
}
