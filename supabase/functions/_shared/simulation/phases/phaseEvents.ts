// Phase: events — iterates pending/active events and applies effect_type switch.
//
// HAND-OFF CONTRACT FOR EPIC 7:
// 1. Add effect resolution logic to the matching case in the switch below.
// 2. If a new effect_type value is added to EventEffectType in simulationTypes.ts,
//    TypeScript produces a compile error here (exhaustive default branch) — update
//    both the switch and the migration CHECK constraint before merging.
// 3. Events are pre-filtered to the current world via SimulationInputState.events;
//    Epic 7 may need to extend SimulationInputState if a case requires additional
//    input (e.g. deposit blueprints for deposit_discovered).
// 4. The phase currently emits no notifications; Epic 7 should add per-event
//    notifications as needed via the notifications return value.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  BuildingStateChange,
  DepositUpdate,
  EventStatusPatch,
  SimEffect,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhaseEventsOutput = {
  readonly buildingStateChanges: readonly BuildingStateChange[];
  readonly depositUpdates: readonly DepositUpdate[];
  readonly eventStatusPatches: readonly EventStatusPatch[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
};

// Helper: apply single effect to shared state
function applyEffect(
  effect: SimEffect,
  eventId: string,
  payload: Record<string, unknown>,
  pendingBuildingDamage: Set<string>,
  pendingBuildingDestroys: BuildingStateChange[],
  pendingEventMultipliers: Map<
    string,
    {
      productionByJobId: Map<string, number>;
      productionByBuildingId: Map<string, number>;
      consumption: number;
      upkeep: number;
    }
  >,
  pendingManagedPopulationDeltas: Map<string, number>,
  pendingStockpiles: Map<string, number>,
  pendingDepositDestroys: Set<string>,
  logs: SimulationLogEntry[],
): void {
  const effectType = effect.effectType;

  try {
    switch (effectType) {
      case "building_damage": {
        const buildingId = payload.buildingId;
        if (typeof buildingId === "string") {
          pendingBuildingDamage.add(buildingId);
          logs.push({
            category: "event.building_damage",
            payload: { buildingId, eventId },
            phase: "events",
          });
        }
        break;
      }

      case "building_destroyed": {
        const settlementBuildingId = effect.settlementBuildingId ?? payload.settlementBuildingId;
        if (typeof settlementBuildingId === "string") {
          pendingBuildingDestroys.push({
            settlementBuildingId,
            toState: "auto_deconstructed",
            missedUpkeepCountDelta: null,
          });
          logs.push({
            category: "event.building_destroyed",
            payload: { settlementBuildingId, eventId },
            phase: "events",
          });
        }
        break;
      }

      case "consumption_multiplier": {
        const settlementId = payload.settlementId;
        const multiplier = effect.multiplierValue ?? payload.multiplier;
        if (typeof settlementId === "string" && typeof multiplier === "number") {
          let mults = pendingEventMultipliers.get(settlementId);
          if (mults === null || mults === undefined) {
            mults = {
              consumption: 1,
              productionByBuildingId: new Map(),
              productionByJobId: new Map(),
              upkeep: 1,
            };
            pendingEventMultipliers.set(settlementId, mults);
          }
          mults.consumption = (mults.consumption ?? 1) * multiplier;
          logs.push({
            category: "event.consumption_multiplier",
            payload: { eventId, multiplier, settlementId },
            phase: "events",
          });
        }
        break;
      }

      case "deposit_discovered": {
        logs.push({
          category: "event.deposit_discovered",
          payload: { eventId },
          phase: "events",
        });
        break;
      }

      case "deposit_destroyed": {
        const depositInstanceId = effect.depositInstanceId ?? payload.depositInstanceId;
        if (typeof depositInstanceId === "string") {
          pendingDepositDestroys.add(depositInstanceId);
          logs.push({
            category: "event.deposit_destroyed",
            payload: { depositInstanceId, eventId },
            phase: "events",
          });
        }
        break;
      }

      case "managed_population_change": {
        const managedPopulationId = payload.managedPopulationId;
        const delta = effect.amountValue ?? payload.delta;
        if (typeof managedPopulationId === "string" && typeof delta === "number") {
          pendingManagedPopulationDeltas.set(
            managedPopulationId,
            (pendingManagedPopulationDeltas.get(managedPopulationId) ?? 0) + delta,
          );
          logs.push({
            category: "event.managed_population_change",
            payload: { delta, eventId, managedPopulationId },
            phase: "events",
          });
        }
        break;
      }

      case "population_boost": {
        const settlementId = payload.settlementId;
        const amount = effect.amountValue ?? payload.amount;
        if (typeof settlementId === "string" && typeof amount === "number") {
          logs.push({
            category: "event.population_boost",
            payload: { amount, eventId, settlementId },
            phase: "events",
          });
        }
        break;
      }

      case "population_loss": {
        const settlementId = payload.settlementId;
        const amount = effect.amountValue ?? payload.amount;
        if (typeof settlementId === "string" && typeof amount === "number") {
          logs.push({
            category: "event.population_loss",
            payload: { amount, eventId, settlementId },
            phase: "events",
          });
        }
        break;
      }

      case "production_multiplier": {
        const settlementId = payload.settlementId;
        const multiplier = effect.multiplierValue ?? payload.multiplier;
        const jobId = effect.jobId ?? payload.jobId;
        const buildingBlueprintId = payload.buildingBlueprintId;

        if (typeof settlementId === "string" && typeof multiplier === "number") {
          let mults = pendingEventMultipliers.get(settlementId);
          if (mults === null || mults === undefined) {
            mults = {
              consumption: 1,
              productionByBuildingId: new Map(),
              productionByJobId: new Map(),
              upkeep: 1,
            };
            pendingEventMultipliers.set(settlementId, mults);
          }

          if (typeof jobId === "string") {
            mults.productionByJobId.set(
              jobId,
              (mults.productionByJobId.get(jobId) ?? 1) * multiplier,
            );
          }
          if (typeof buildingBlueprintId === "string") {
            mults.productionByBuildingId.set(
              buildingBlueprintId,
              (mults.productionByBuildingId.get(buildingBlueprintId) ?? 1) * multiplier,
            );
          }

          logs.push({
            category: "event.production_multiplier",
            payload: {
              buildingBlueprintId,
              eventId,
              jobId,
              multiplier,
              settlementId,
            },
            phase: "events",
          });
        }
        break;
      }

      case "resource_drain": {
        const resourceId = effect.resourceId ?? payload.resourceId;
        const settlementId = payload.settlementId;
        const amount = effect.amountValue ?? payload.amount;
        if (
          typeof resourceId === "string" &&
          typeof settlementId === "string" &&
          typeof amount === "number"
        ) {
          const key = `${settlementId}:${resourceId}`;
          const current = pendingStockpiles.get(key) ?? 0;
          pendingStockpiles.set(key, Math.max(0, current - amount));
          logs.push({
            category: "event.resource_drain",
            payload: {
              amount,
              eventId,
              resourceId,
              settlementId,
            },
            phase: "events",
          });
        }
        break;
      }

      case "resource_grant": {
        const resourceId = effect.resourceId ?? payload.resourceId;
        const settlementId = payload.settlementId;
        const amount = effect.amountValue ?? payload.amount;
        if (
          typeof resourceId === "string" &&
          typeof settlementId === "string" &&
          typeof amount === "number"
        ) {
          const key = `${settlementId}:${resourceId}`;
          pendingStockpiles.set(key, (pendingStockpiles.get(key) ?? 0) + amount);
          logs.push({
            category: "event.resource_grant",
            payload: {
              amount,
              eventId,
              resourceId,
              settlementId,
            },
            phase: "events",
          });
        }
        break;
      }

      case "upkeep_multiplier": {
        const settlementId = payload.settlementId;
        const multiplier = effect.multiplierValue ?? payload.multiplier;
        if (typeof settlementId === "string" && typeof multiplier === "number") {
          let mults = pendingEventMultipliers.get(settlementId);
          if (mults === null || mults === undefined) {
            mults = {
              consumption: 1,
              productionByBuildingId: new Map(),
              productionByJobId: new Map(),
              upkeep: 1,
            };
            pendingEventMultipliers.set(settlementId, mults);
          }
          mults.upkeep = (mults.upkeep ?? 1) * multiplier;
          logs.push({
            category: "event.upkeep_multiplier",
            payload: { eventId, multiplier, settlementId },
            phase: "events",
          });
        }
        break;
      }

      default: {
        const _: never = effectType;
        void _;
        break;
      }
    }
  } catch (error) {
    logs.push({
      category: "event.error",
      payload: {
        error: error instanceof Error ? error.message : String(error),
        eventId,
      },
      phase: "events",
    });
  }
}

export function phaseEvents(context: SimulationContext): PhaseEventsOutput {
  const { events, turnNumber } = context.input;
  const {
    pendingBuildingDamage,
    pendingEventMultipliers,
    pendingManagedPopulationDeltas,
    pendingStockpiles,
    pendingDepositDestroys,
  } = context.shared;

  const buildingStateChanges: BuildingStateChange[] = [];
  const eventStatusPatches: EventStatusPatch[] = [];
  const logs: SimulationLogEntry[] = [];
  const notifications: SimulationNotification[] = [];

  for (const event of events) {
    if (event.status !== "pending" && event.status !== "active") continue;
    if (event.activateOnTransitionAfterTurnNumber > turnNumber) continue;

    // Apply new-style effects if available, otherwise apply old-style effectType for backward compat
    const effectsToApply = event.effects.length > 0 ? event.effects : 
      // Backward compat: synthesize a single old-style effect from effectType + payload
      [{
        id: `legacy-${event.id}`,
        effectType: event.effectType,
        amountValue: null,
        multiplierValue: null,
        isPercent: false,
        resourceId: null,
        jobId: null,
        managedPopulationInstanceId: null,
        depositInstanceId: null,
        settlementBuildingId: null,
      }];
    
    for (const effect of effectsToApply) {
      applyEffect(
        effect,
        event.id,
        event.effectPayloadJsonb,
        pendingBuildingDamage,
        buildingStateChanges,
        pendingEventMultipliers,
        pendingManagedPopulationDeltas,
        pendingStockpiles,
        pendingDepositDestroys,
        logs,
      );
    }

    // Compute new status and emit patch.
    // pending → first activation this turn
    // active  → sustained event already running, count down
    const fromStatus = event.status;
    let toStatus: "active" | "expired";
    let nextRemainingTransitions: number | null;

    if (fromStatus === "pending") {
      if (event.durationType === "sustained") {
        const rt = event.remainingTransitions ?? 1;
        if (rt <= 1) {
          toStatus = "expired";
          nextRemainingTransitions = 0;
        } else {
          toStatus = "active";
          nextRemainingTransitions = rt - 1;
        }
      } else {
        // instant
        toStatus = "expired";
        nextRemainingTransitions = null;
      }
    } else {
      // active (sustained, counting down)
      const rt = event.remainingTransitions ?? 1;
      if (rt <= 1) {
        toStatus = "expired";
        nextRemainingTransitions = 0;
      } else {
        toStatus = "active";
        nextRemainingTransitions = rt - 1;
      }
    }

    eventStatusPatches.push({
      eventId: event.id,
      fromStatus,
      remainingTransitions: nextRemainingTransitions,
      toStatus,
    });
  }

  const depositUpdates: DepositUpdate[] = Array.from(pendingDepositDestroys).map(
    (depositInstanceId) => ({
      depositInstanceId,
      resourceDeltas: [],
      toStatus: "removed" as const,
    }),
  );

  return { buildingStateChanges, depositUpdates, eventStatusPatches, logs, notifications };
}
