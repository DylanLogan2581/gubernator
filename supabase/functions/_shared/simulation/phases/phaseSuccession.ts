// Phase: succession — detects nations whose manager citizen ("ruler") died
// this transition and computes succession candidates per the nation's
// government rules. Does not assign a new manager: admins (or a future
// eligible-player flow) resolve the vacancy via the existing role RPCs.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { getSuccessionCandidates, GOVERNMENT_RULES } from "../../government/index.ts";
import { compareById } from "../sortUtils.ts";

import type { CitizenSuccessionInfo } from "../../government/index.ts";
import type {
  CitizenDeath,
  SimCitizen,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhaseSuccessionOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
};

function formatCitizenName(citizen: {
  readonly givenName: string;
  readonly surname: string | null;
}): string {
  return citizen.surname !== null ? `${citizen.givenName} ${citizen.surname}` : citizen.givenName;
}

// Deterministic: eldest (lowest bornOnTurnNumber) first, then citizenId
// ascending. Null bornOnTurnNumber sorts before any real turn.
function byAgeThenId(a: SimCitizen, b: SimCitizen): number {
  const aTurn = a.bornOnTurnNumber ?? -Infinity;
  const bTurn = b.bornOnTurnNumber ?? -Infinity;
  if (aTurn !== bTurn) return aTurn - bTurn;
  return compareById(a, b);
}

export function phaseSuccession(
  context: SimulationContext,
  allDeaths: readonly CitizenDeath[],
): PhaseSuccessionOutput {
  const { citizens, nations, settlements } = context.input;

  const deadCitizenIds = new Set(allDeaths.map((d) => d.citizenId));
  const nationIdBySettlementId = new Map(
    settlements
      .filter((s) => s.nationId !== undefined)
      .map((s) => [s.id, s.nationId as string]),
  );
  const nationById = new Map(nations.map((n) => [n.id, n]));

  const deadRulers = citizens
    .filter(
      (c) =>
        c.roleType === "nation_manager" &&
        c.roleNationId !== null &&
        deadCitizenIds.has(c.id),
    )
    .slice()
    .sort((a, b) => {
      const nationCompare = (a.roleNationId as string).localeCompare(
        b.roleNationId as string,
      );
      return nationCompare !== 0 ? nationCompare : compareById(a, b);
    });

  const logs: SimulationLogEntry[] = [];
  const notifications: SimulationNotification[] = [];

  for (const ruler of deadRulers) {
    const nationId = ruler.roleNationId as string;
    const nation = nationById.get(nationId);
    if (nation === undefined) continue;

    const nationCitizens = citizens
      .filter(
        (c) =>
          c.settlementId !== null &&
          nationIdBySettlementId.get(c.settlementId) === nationId,
      )
      .slice()
      .sort(byAgeThenId);

    const successionCitizens: CitizenSuccessionInfo[] = nationCitizens.map(
      (c) => ({
        bornOnTurnNumber: c.bornOnTurnNumber,
        citizenId: c.id,
        parentACitizenId: c.parentACitizenId,
        parentBCitizenId: c.parentBCitizenId,
        status: deadCitizenIds.has(c.id) ? "dead" : c.status,
      }),
    );

    const settlementManagerCitizenIds = nationCitizens
      .filter(
        (c) => c.roleType === "settlement_manager" && !deadCitizenIds.has(c.id),
      )
      .map((c) => c.id);

    const candidateCitizenIds = getSuccessionCandidates({
      citizens: successionCitizens,
      governmentType: nation.governmentType,
      officeHolders: [],
      rulerCitizenId: ruler.id,
      settlementManagerCitizenIds,
    });

    const candidateNamesById = new Map(
      nationCitizens.map((c) => [c.id, formatCitizenName(c)]),
    );
    const candidateNames = candidateCitizenIds
      .map((id) => candidateNamesById.get(id))
      .filter((name): name is string => name !== undefined);

    const successionMode = GOVERNMENT_RULES[nation.governmentType].successionMode;

    logs.push({
      category: "government.succession",
      citizenId: ruler.id,
      nationId,
      payload: {
        candidateCitizenIds,
        governmentType: nation.governmentType,
        successionMode,
      },
      phase: "succession",
    });

    notifications.push({
      messageText: `Ruler ${formatCitizenName(ruler)} of ${nation.name} has died. ` +
        `Succession: ${successionMode}. ` +
        `Candidates: ${candidateNames.length > 0 ? candidateNames.join(", ") : "none"}.`,
      nationId,
      notificationType: "nation.succession",
      scope: "nation",
    });
  }

  return { logs, notifications };
}
