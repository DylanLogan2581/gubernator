// Phase: military upkeep — charges every army its per-soldier upkeep cost
// against its funding source (nation stockpile or host settlement
// stockpile), paying whatever is available per resource. Any shortfall
// leaves the army "unpaid" for the turn: every unit under it loses
// floor(soldiers * desertionRate) soldiers (minimum 1 when soldiers > 0 and
// the rate > 0), chosen deterministically via a seeded RNG shuffle ordered
// by soldier id. Deserters return to civilian life at their
// home_settlement_id (falling back to the army's stationed settlement).
// Units that reach zero soldiers are disbanded; their parent army/group
// structure is left intact.
//
// Runs after phaseNationalEconomy (post-tax nation stockpiles) and after
// phaseManagedPopulations, before phaseCitizenConsumption. Deterministic
// decimal math except for seeded-RNG deserter selection.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import { floorToDatabaseScale } from "../decimalMath.ts";
import { createSeededRng, pickDeterministic } from "../seededRng.ts";
import { compareById } from "../sortUtils.ts";

import type {
  ArmyTurnSnapshot,
  DesertedSoldier,
  DisbandedUnit,
  NationStockpileDelta,
  SimArmyUnit,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
  SimUnitSoldier,
  StockpileDelta,
} from "../simulationTypes.ts";

export type PhaseMilitaryUpkeepOutput = {
  readonly armyTurnSnapshots: readonly ArmyTurnSnapshot[];
  readonly desertedSoldiers: readonly DesertedSoldier[];
  readonly disbandedUnits: readonly DisbandedUnit[];
  readonly logs: readonly SimulationLogEntry[];
  readonly nationStockpileDeltas: readonly NationStockpileDelta[];
  readonly notifications: readonly SimulationNotification[];
  readonly stockpileDeltas: readonly StockpileDelta[];
};

export function phaseMilitaryUpkeep(context: SimulationContext): PhaseMilitaryUpkeepOutput {
  const { armies, armyUnits, turnNumber, unitSoldiers, unitTypes, worldId } = context.input;

  const unitTypeById = new Map(unitTypes.map((ut) => [ut.id, ut]));
  const unitsByArmyId = new Map<string, SimArmyUnit[]>();
  for (const unit of armyUnits) {
    const list = unitsByArmyId.get(unit.armyId) ?? [];
    list.push(unit);
    unitsByArmyId.set(unit.armyId, list);
  }
  const soldiersByUnitId = new Map<string, SimUnitSoldier[]>();
  for (const soldier of unitSoldiers) {
    const list = soldiersByUnitId.get(soldier.unitId) ?? [];
    list.push(soldier);
    soldiersByUnitId.set(soldier.unitId, list);
  }

  // Running local view of both stockpile pools — each army's payment must
  // see the deductions made by armies paid earlier in this same phase.
  const settlementPool = new Map(context.shared.pendingStockpiles);
  const nationPool = new Map(context.shared.pendingNationStockpiles);

  const armyTurnSnapshots: ArmyTurnSnapshot[] = [];
  const desertedSoldiers: DesertedSoldier[] = [];
  const disbandedUnits: DisbandedUnit[] = [];
  const logs: SimulationLogEntry[] = [];
  const notifications: SimulationNotification[] = [];
  const stockpileDeltas: StockpileDelta[] = [];
  const nationStockpileDeltas: NationStockpileDelta[] = [];

  for (const army of [...armies].sort(compareById)) {
    const units = unitsByArmyId.get(army.id) ?? [];

    // Total upkeep required per resource, summed across every unit in the army.
    const requiredByResource = new Map<string, number>();
    for (const unit of units) {
      const unitType = unitTypeById.get(unit.unitTypeId);
      if (unitType === undefined) continue;
      const soldierCount = (soldiersByUnitId.get(unit.id) ?? []).length;
      if (soldierCount === 0) continue;
      for (const cost of unitType.upkeepCostsJson) {
        const amount = floorToDatabaseScale(cost.amount * soldierCount);
        requiredByResource.set(
          cost.resourceId,
          (requiredByResource.get(cost.resourceId) ?? 0) + amount,
        );
      }
    }

    const poolKeyPrefix = army.fundingSource === "nation"
      ? army.nationId
      : army.stationedSettlementId;
    const pool = army.fundingSource === "nation" ? nationPool : settlementPool;

    let upkeepPaid = true;
    for (const [resourceId, required] of requiredByResource) {
      if (required <= 0) continue;
      const key = `${poolKeyPrefix}:${resourceId}`;
      const available = Math.max(0, pool.get(key) ?? 0);
      const paid = Math.min(required, available);
      if (paid > 0) {
        pool.set(key, available - paid);
        if (army.fundingSource === "nation") {
          nationStockpileDeltas.push({ delta: -paid, nationId: army.nationId, resourceId });
        } else {
          stockpileDeltas.push({
            delta: -paid,
            resourceId,
            settlementId: army.stationedSettlementId,
          });
        }
      }
      if (paid < required) {
        upkeepPaid = false;
      }
    }

    let soldierCountTotal = 0;
    const soldiersByUnitType = new Map<string, number>();
    let totalDeserted = 0;

    for (const unit of units) {
      const unitType = unitTypeById.get(unit.unitTypeId);
      const soldiers = [...(soldiersByUnitId.get(unit.id) ?? [])].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      );

      let remainingSoldiers = soldiers;

      if (!upkeepPaid && unitType !== undefined && soldiers.length > 0) {
        const desertionRate = unitType.desertionRate;
        if (desertionRate > 0) {
          const rawCount = Math.floor(soldiers.length * desertionRate);
          const desertionCount = Math.min(soldiers.length, Math.max(rawCount, 1));

          const rng = createSeededRng(`${worldId}:${turnNumber}:militaryUpkeep:${unit.id}`);
          const deserters = pickDeterministic(rng, soldiers, desertionCount);
          const deserterIds = new Set(deserters.map((s) => s.id));

          for (const soldier of deserters) {
            desertedSoldiers.push({
              citizenId: soldier.citizenId,
              newSettlementId: soldier.homeSettlementId ?? army.stationedSettlementId,
              soldierId: soldier.id,
              unitId: unit.id,
            });
          }
          totalDeserted += deserters.length;
          remainingSoldiers = soldiers.filter((s) => !deserterIds.has(s.id));
        }
      }

      if (unitType !== undefined) {
        soldiersByUnitType.set(
          unit.unitTypeId,
          (soldiersByUnitType.get(unit.unitTypeId) ?? 0) + remainingSoldiers.length,
        );
      }
      soldierCountTotal += remainingSoldiers.length;

      if (remainingSoldiers.length === 0 && soldiers.length > 0) {
        disbandedUnits.push({ armyId: army.id, unitId: unit.id });
        logs.push({
          category: "military.unit_disbanded",
          nationId: army.nationId,
          payload: { armyId: army.id, unitId: unit.id },
          phase: "militaryUpkeep",
        });
        notifications.push({
          messageText: `A unit in ${army.name} disbanded after losing all its soldiers.`,
          nationId: army.nationId,
          notificationType: "military.unit_disbanded",
          scope: "nation",
        });
      }
    }

    const soldiersByUnitTypeJson: Record<string, number> = {};
    for (const [unitTypeId, count] of soldiersByUnitType) {
      soldiersByUnitTypeJson[unitTypeId] = count;
    }

    armyTurnSnapshots.push({
      armyId: army.id,
      soldierCountTotal,
      soldiersByUnitTypeJson,
      turnNumber,
      upkeepPaid,
    });

    if (!upkeepPaid) {
      logs.push({
        category: "military.upkeep_unpaid",
        nationId: army.nationId,
        payload: { armyId: army.id, desertedSoldierCount: totalDeserted },
        phase: "militaryUpkeep",
      });
      notifications.push({
        messageText: `${army.name} went unpaid — ${totalDeserted} soldier${
          totalDeserted === 1 ? "" : "s"
        } deserted`,
        nationId: army.nationId,
        notificationType: "military.upkeep_unpaid",
        scope: "nation",
      });
    }
  }

  return {
    armyTurnSnapshots,
    desertedSoldiers,
    disbandedUnits,
    logs,
    nationStockpileDeltas,
    notifications,
    stockpileDeltas,
  };
}
