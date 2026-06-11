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
  EventEffectType,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhaseEventsOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
};

export function phaseEvents(context: SimulationContext): PhaseEventsOutput {
  const { events, turnNumber } = context.input;
  const {
    pendingBuildingDamage,
    pendingEventMultipliers,
    pendingManagedPopulationDeltas,
    pendingStockpiles,
  } = context.shared;

  const logs: SimulationLogEntry[] = [];
  const notifications: SimulationNotification[] = [];

  for (const event of events) {
    if (event.status !== "pending" && event.status !== "active") continue;
    if (event.activateOnTransitionAfterTurnNumber > turnNumber) continue;

    const effectType: EventEffectType = event.effectType;
    const payload = event.effectPayloadJsonb;

    try {
      switch (effectType) {
        case "building_damage": {
          const buildingId = payload.buildingId;
          if (typeof buildingId === "string") {
            pendingBuildingDamage.add(buildingId);
            logs.push({
              category: "event.building_damage",
              payload: { buildingId, eventId: event.id },
              phase: "events",
            });
          }
          break;
        }

        case "consumption_multiplier": {
          const settlementId = payload.settlementId;
          const multiplier = payload.multiplier;
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
              payload: { eventId: event.id, multiplier, settlementId },
              phase: "events",
            });
          }
          break;
        }

        case "deposit_discovered": {
          logs.push({
            category: "event.deposit_discovered",
            payload: { eventId: event.id },
            phase: "events",
          });
          break;
        }

        case "managed_population_change": {
          const managedPopulationId = payload.managedPopulationId;
          const delta = payload.delta;
          if (typeof managedPopulationId === "string" && typeof delta === "number") {
            pendingManagedPopulationDeltas.set(
              managedPopulationId,
              (pendingManagedPopulationDeltas.get(managedPopulationId) ?? 0) + delta,
            );
            logs.push({
              category: "event.managed_population_change",
              payload: { delta, eventId: event.id, managedPopulationId },
              phase: "events",
            });
          }
          break;
        }

        case "population_boost": {
          const settlementId = payload.settlementId;
          const amount = payload.amount;
          if (typeof settlementId === "string" && typeof amount === "number") {
            // Noted in log; actual citizen creation handled elsewhere if needed.
            logs.push({
              category: "event.population_boost",
              payload: { amount, eventId: event.id, settlementId },
              phase: "events",
            });
          }
          break;
        }

        case "population_loss": {
          const settlementId = payload.settlementId;
          const amount = payload.amount;
          if (typeof settlementId === "string" && typeof amount === "number") {
            // Noted in log; actual citizen removal handled elsewhere if needed.
            logs.push({
              category: "event.population_loss",
              payload: { amount, eventId: event.id, settlementId },
              phase: "events",
            });
          }
          break;
        }

        case "production_multiplier": {
          const settlementId = payload.settlementId;
          const multiplier = payload.multiplier;
          const jobId = payload.jobId;
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
                (mults.productionByBuildingId.get(buildingBlueprintId) ?? 1) *
                  multiplier,
              );
            }

            logs.push({
              category: "event.production_multiplier",
              payload: {
                buildingBlueprintId,
                eventId: event.id,
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
          const resourceId = payload.resourceId;
          const settlementId = payload.settlementId;
          const amount = payload.amount;
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
                eventId: event.id,
                resourceId,
                settlementId,
              },
              phase: "events",
            });
          }
          break;
        }

        case "resource_grant": {
          const resourceId = payload.resourceId;
          const settlementId = payload.settlementId;
          const amount = payload.amount;
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
                eventId: event.id,
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
          const multiplier = payload.multiplier;
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
              payload: { eventId: event.id, multiplier, settlementId },
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
          eventId: event.id,
        },
        phase: "events",
      });
    }
  }

  return { logs, notifications };
}
