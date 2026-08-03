// Phase: treaties — applies active nation_treaties effects each transition
// (#1090): tribute transfers a nation's stockpile into another's, in kind;
// time-limited treaties expire; royal marriages get a death note when either
// linked citizen dies this transition. Deterministic, ordered by treaty id,
// no RNG.
//
// Split into two entry points because of a pipeline ordering constraint:
// phaseTreaties (tribute + expiry) needs only the running nation stockpile
// totals and is called alongside phaseNationalEconomy so tribute can spend
// from goods taxed earlier the same transition. phaseTreatyMarriageNotes
// needs the full set of this-turn deaths, which isn't known until the
// mortality-causing phases (citizen consumption, homelessness, events) have
// all run — so it's called later, just before phase 13 (logs & snapshots),
// mirroring phaseSuccession's allDeaths dependency.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { compareById } from "../sortUtils.ts";

import type {
  CitizenDeath,
  NationStockpileDelta,
  NationTurnSnapshot,
  SimTreaty,
  SimulationContext,
  SimulationLogEntry,
  TreatyStatusChange,
} from "../simulationTypes.ts";

export type PhaseTreatiesOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly nationStockpileDeltas: readonly NationStockpileDelta[];
  readonly nationTurnSnapshots: readonly NationTurnSnapshot[];
  readonly treatyStatusChanges: readonly TreatyStatusChange[];
};

export type PhaseTreatyMarriageNotesOutput = {
  readonly logs: readonly SimulationLogEntry[];
};

function tributeParties(
  treaty: SimTreaty,
): { readonly payerNationId: string; readonly payeeNationId: string } {
  return treaty.tributePayer === "proposer"
    ? { payerNationId: treaty.proposerNationId, payeeNationId: treaty.responderNationId }
    : { payerNationId: treaty.responderNationId, payeeNationId: treaty.proposerNationId };
}

/**
 * Applies tribute transfers and expiry to active treaties.
 *
 * @param context - Simulation context; reads nationTreaties/turnNumber and
 *   the running pendingNationStockpiles map (post-tax-credit quantities from
 *   phaseNationalEconomy) to cap tribute at what the payer actually has.
 */
export function phaseTreaties(context: SimulationContext): PhaseTreatiesOutput {
  const { nationTreaties, turnNumber } = context.input;
  const { pendingNationStockpiles } = context.shared;

  const newTurnNumber = turnNumber + 1;
  const sortedTreaties = [...nationTreaties].sort(compareById);

  const logs: SimulationLogEntry[] = [];
  const nationStockpileDeltas: NationStockpileDelta[] = [];
  const treatyStatusChanges: TreatyStatusChange[] = [];

  // pendingNationStockpiles is read-only here — this phase reports transfers
  // via nationStockpileDeltas only, and the orchestrator applies them once
  // (runSimulation.ts). This local overlay lets sequential treaties this same
  // phase call see the effect of earlier transfers without mutating the
  // shared map directly (that would double-apply once the orchestrator also
  // applies nationStockpileDeltas — issue #1127).
  const localStockpileDeltas = new Map<string, number>();

  // nationId -> resourceId -> amount, tracked separately from
  // phaseNationalEconomy's tax totals so nationTurnSnapshots can report both.
  const tributePaid = new Map<string, Map<string, number>>();
  const tributeReceived = new Map<string, Map<string, number>>();

  function addTo(
    totals: Map<string, Map<string, number>>,
    nationId: string,
    resourceId: string,
    amount: number,
  ): void {
    let byResource = totals.get(nationId);
    if (byResource === undefined) {
      byResource = new Map();
      totals.set(nationId, byResource);
    }
    byResource.set(resourceId, (byResource.get(resourceId) ?? 0) + amount);
  }

  for (const treaty of sortedTreaties) {
    // Inclusive: a treaty ending on newTurnNumber (the turn about to start)
    // pays no further tribute — it is expired for that turn, not one turn
    // later.
    const isExpiring = treaty.endsTurnNumber !== null && treaty.endsTurnNumber <= newTurnNumber;

    if (
      !isExpiring &&
      treaty.treatyType === "tribute" &&
      treaty.tributePayer !== null &&
      treaty.tributeResourceId !== null &&
      treaty.tributeQuantityPerTurn !== null &&
      treaty.tributeQuantityPerTurn > 0
    ) {
      const { payerNationId, payeeNationId } = tributeParties(treaty);
      const resourceId = treaty.tributeResourceId;
      const requested = treaty.tributeQuantityPerTurn;

      const payerKey = `${payerNationId}:${resourceId}`;
      const available = Math.max(
        0,
        (pendingNationStockpiles.get(payerKey) ?? 0) + (localStockpileDeltas.get(payerKey) ?? 0),
      );
      const transferred = Math.min(requested, available);

      if (transferred > 0) {
        const payeeKey = `${payeeNationId}:${resourceId}`;
        localStockpileDeltas.set(payerKey, (localStockpileDeltas.get(payerKey) ?? 0) - transferred);
        localStockpileDeltas.set(payeeKey, (localStockpileDeltas.get(payeeKey) ?? 0) + transferred);

        nationStockpileDeltas.push({ delta: -transferred, nationId: payerNationId, resourceId });
        nationStockpileDeltas.push({ delta: transferred, nationId: payeeNationId, resourceId });

        addTo(tributePaid, payerNationId, resourceId, transferred);
        addTo(tributeReceived, payeeNationId, resourceId, transferred);

        logs.push({
          category: "nation.tribute_transferred",
          nationId: payerNationId,
          payload: {
            payeeNationId,
            payerNationId,
            quantityTransferred: transferred,
            resourceId,
            treatyId: treaty.id,
          },
          phase: "treaties",
          resourceId,
        });
      }

      const missing = requested - transferred;
      if (missing > 0) {
        logs.push({
          category: "nation.tribute_missed",
          nationId: payerNationId,
          payload: {
            payeeNationId,
            payerNationId,
            quantityMissing: missing,
            quantityRequested: requested,
            quantityTransferred: transferred,
            resourceId,
            treatyId: treaty.id,
          },
          phase: "treaties",
          resourceId,
        });
      }
    }

    if (isExpiring) {
      treatyStatusChanges.push({ toStatus: "expired", treatyId: treaty.id });
      logs.push({
        category: "nation.treaty_expired",
        nationId: treaty.proposerNationId,
        payload: {
          proposerNationId: treaty.proposerNationId,
          responderNationId: treaty.responderNationId,
          treatyId: treaty.id,
          treatyType: treaty.treatyType,
        },
        phase: "treaties",
      });
    }
  }

  const nationIdsWithTributeActivity = new Set<string>([
    ...tributePaid.keys(),
    ...tributeReceived.keys(),
  ]);

  const nationTurnSnapshots: NationTurnSnapshot[] = [...nationIdsWithTributeActivity].sort().map(
    (nationId) => ({
      nationId,
      taxCollectedByResource: {},
      tributePaidByResource: Object.fromEntries(tributePaid.get(nationId) ?? []),
      tributeReceivedByResource: Object.fromEntries(tributeReceived.get(nationId) ?? []),
    }),
  );

  return { logs, nationStockpileDeltas, nationTurnSnapshots, treatyStatusChanges };
}

/**
 * Logs a note on active royal_marriage treaties whose linked citizen died
 * this transition. The treaty stays active — humans decide consequences.
 *
 * @param context - Simulation context; reads nationTreaties.
 * @param allDeaths - Every citizen death recorded this transition, across
 *   all mortality-causing phases (consumption, homelessness, events).
 */
export function phaseTreatyMarriageNotes(
  context: SimulationContext,
  allDeaths: readonly CitizenDeath[],
): PhaseTreatyMarriageNotesOutput {
  const { nationTreaties } = context.input;
  const deadCitizenIds = new Set(allDeaths.map((d) => d.citizenId));

  const logs: SimulationLogEntry[] = [];

  const sortedTreaties = [...nationTreaties].sort(compareById);
  for (const treaty of sortedTreaties) {
    if (treaty.treatyType !== "royal_marriage") continue;

    const deceasedCitizenIds = [treaty.marriageCitizenAId, treaty.marriageCitizenBId].filter(
      (citizenId): citizenId is string => citizenId !== null && deadCitizenIds.has(citizenId),
    );
    if (deceasedCitizenIds.length === 0) continue;

    logs.push({
      category: "nation.treaty_marriage_death_note",
      nationId: treaty.proposerNationId,
      payload: {
        deceasedCitizenIds,
        proposerNationId: treaty.proposerNationId,
        responderNationId: treaty.responderNationId,
        treatyId: treaty.id,
      },
      phase: "treaties",
    });
  }

  return { logs };
}
