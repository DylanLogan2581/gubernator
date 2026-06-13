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
  EventStatusPatch,
  SimEventStatus,
  SimulationContext,
  SimulationLogEntry,
  SimulationNotification,
} from "../simulationTypes.ts";

export type PhaseEventsOutput = {
  readonly eventStatusPatches: readonly EventStatusPatch[];
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
};

export function phaseEvents(context: SimulationContext): PhaseEventsOutput {
  const { events, settlements, turnNumber } = context.input;

  const logs: SimulationLogEntry[] = [];
  const eventStatusPatches: EventStatusPatch[] = [];

  // Build a settlement lookup for scope resolution
  const settlementById = new Map(settlements.map((s) => [s.id, s]));
  const settlementIdsByNationId = new Map<string, string[]>();
  for (const settlement of settlements) {
    const nationId = settlement.nationId;
    if (typeof nationId === "string") {
      if (!settlementIdsByNationId.has(nationId)) {
        settlementIdsByNationId.set(nationId, []);
      }
      const ids = settlementIdsByNationId.get(nationId);
      if (ids !== undefined) {
        ids.push(settlement.id);
      }
    }
  }

  for (const event of events) {
    // Skip already-resolved or already-expired or cancelled events
    if (
      event.status === "resolved" ||
      event.status === "expired" ||
      event.status === "cancelled"
    ) {
      continue;
    }

    // Skip if not yet activated
    if (event.activateOnTransitionAfterTurnNumber > turnNumber) {
      continue;
    }

    // Event is eligible for processing
    const effectType: EventEffectType = event.effectType;
    const payload = event.effectPayloadJsonb;

    // Resolve scope to settlement IDs
    const targetSettlementIds: string[] = [];
    if (event.scopeType === "world") {
      targetSettlementIds.push(...settlementById.keys());
    } else if (event.scopeType === "nation") {
      const nationId = event.scopeNationId;
      if (nationId !== undefined && nationId !== null) {
        const ids = settlementIdsByNationId.get(nationId) ?? [];
        targetSettlementIds.push(...ids);
      }
    } else if (event.scopeType === "settlement") {
      const settlementId = event.scopeSettlementId;
      if (settlementId !== undefined && settlementId !== null) {
        targetSettlementIds.push(settlementId);
      }
    }

    // Process effect and log per target settlement
    try {
      switch (effectType) {
        case "building_damage": {
          const buildingId = payload.buildingId;
          if (typeof buildingId === "string") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.building_damage",
                payload: {
                  buildingId,
                  eventId: event.id,
                  groupId: event.groupId,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        case "building_destroyed": {
          const settlementBuildingId = payload.settlementBuildingId;
          if (typeof settlementBuildingId === "string") {
            logs.push({
              category: "event.building_destroyed",
              payload: {
                settlementBuildingId,
                eventId: event.id,
                groupId: event.groupId,
                scope: event.scopeType,
              },
              phase: "events",
            });
          }
          break;
        }

        case "consumption_multiplier": {
          const multiplier = payload.multiplier;
          if (typeof multiplier === "number") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.consumption_multiplier",
                payload: {
                  eventId: event.id,
                  groupId: event.groupId,
                  multiplier,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        case "deposit_discovered": {
          for (const settlementId of targetSettlementIds) {
            logs.push({
              category: "event.deposit_discovered",
              payload: {
                eventId: event.id,
                groupId: event.groupId,
                scope: event.scopeType,
                settlementId,
              },
              phase: "events",
            });
          }
          break;
        }

        case "deposit_destroyed": {
          const depositInstanceId = payload.depositInstanceId;
          if (typeof depositInstanceId === "string") {
            logs.push({
              category: "event.deposit_destroyed",
              payload: {
                depositInstanceId,
                eventId: event.id,
                groupId: event.groupId,
                scope: event.scopeType,
              },
              phase: "events",
            });
          }
          break;
        }

        case "managed_population_change": {
          const delta = payload.delta;
          const mode = payload.managed_population_mode ?? "instance";
          const managedPopulationTypeId = payload.managed_population_type_id;

          if (typeof delta !== "number") {
            break;
          }

          // Collect target populations based on mode
          const targetPopulations: Array<{
            readonly id: string;
            readonly settlementId: string;
          }> = [];

          if (mode === "all") {
            // Mode 1: All managed populations in target settlements
            for (const population of context.input.managedPopulations) {
              if (targetSettlementIds.includes(population.settlementId)) {
                targetPopulations.push({
                  id: population.id,
                  settlementId: population.settlementId,
                });
              }
            }
          } else if (mode === "type") {
            // Mode 2: All populations of a specific type in target settlements
            if (typeof managedPopulationTypeId === "string") {
              for (const population of context.input.managedPopulations) {
                if (
                  population.managedPopulationTypeId ===
                    managedPopulationTypeId &&
                  targetSettlementIds.includes(population.settlementId)
                ) {
                  targetPopulations.push({
                    id: population.id,
                    settlementId: population.settlementId,
                  });
                }
              }
            }
          } else {
            // Mode 3 (or default): Specific instance (legacy/explicit)
            const managedPopulationId = payload.managedPopulationId;
            if (typeof managedPopulationId === "string") {
              const population = context.input.managedPopulations.find(
                (p) => p.id === managedPopulationId,
              );
              if (
                population !== undefined &&
                targetSettlementIds.includes(population.settlementId)
              ) {
                targetPopulations.push({
                  id: population.id,
                  settlementId: population.settlementId,
                });
              }
            }
          }

          // Emit logs for each target population
          for (const population of targetPopulations) {
            logs.push({
              category: "event.managed_population_change",
              payload: {
                delta,
                eventId: event.id,
                groupId: event.groupId,
                managedPopulationId: population.id,
                scope: event.scopeType,
                settlementId: population.settlementId,
              },
              phase: "events",
            });
          }

          break;
        }

        case "population_boost": {
          const amount = payload.amount;
          if (typeof amount === "number") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.population_boost",
                payload: {
                  amount,
                  eventId: event.id,
                  groupId: event.groupId,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        case "population_loss": {
          const amount = payload.amount;
          if (typeof amount === "number") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.population_loss",
                payload: {
                  amount,
                  eventId: event.id,
                  groupId: event.groupId,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        case "production_multiplier": {
          const multiplier = payload.multiplier;
          const jobId = payload.jobId;
          const buildingBlueprintId = payload.buildingBlueprintId;
          if (typeof multiplier === "number") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.production_multiplier",
                payload: {
                  buildingBlueprintId,
                  eventId: event.id,
                  groupId: event.groupId,
                  jobId,
                  multiplier,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        case "resource_drain": {
          const resourceId = payload.resourceId;
          const amount = payload.amount;
          if (typeof resourceId === "string" && typeof amount === "number") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.resource_drain",
                payload: {
                  amount,
                  eventId: event.id,
                  groupId: event.groupId,
                  resourceId,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        case "resource_grant": {
          const resourceId = payload.resourceId;
          const amount = payload.amount;
          if (typeof resourceId === "string" && typeof amount === "number") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.resource_grant",
                payload: {
                  amount,
                  eventId: event.id,
                  groupId: event.groupId,
                  resourceId,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        case "upkeep_multiplier": {
          const multiplier = payload.multiplier;
          if (typeof multiplier === "number") {
            for (const settlementId of targetSettlementIds) {
              logs.push({
                category: "event.upkeep_multiplier",
                payload: {
                  eventId: event.id,
                  groupId: event.groupId,
                  multiplier,
                  scope: event.scopeType,
                  settlementId,
                },
                phase: "events",
              });
            }
          }
          break;
        }

        default: {
          const _: never = effectType;
          void _;
          break;
        }
      }
    } catch (caught) {
      let errorMsg = "Unknown error";
      if (caught instanceof Error) {
        errorMsg = caught.message;
      } else if (typeof caught === "string") {
        errorMsg = caught;
      }
      logs.push({
        category: "event.error",
        payload: {
          error: errorMsg,
          eventId: event.id,
        },
        phase: "events",
      });
    }

    // Update event status patches for sustained duration and expiry
    let newStatus: SimEventStatus = event.status;
    let newRemainingTransitions = event.remainingTransitions;

    if (event.status === "pending") {
      // Transition pending → active
      newStatus = "active";
    } else if (
      event.status === "active" &&
      event.remainingTransitions !== undefined &&
      event.remainingTransitions !== null
    ) {
      // Decrement and check for expiry
      newRemainingTransitions = event.remainingTransitions - 1;
      if (newRemainingTransitions <= 0) {
        newStatus = "expired";
        newRemainingTransitions = undefined;
      }
    }

    // Record patch if status changed
    if (newStatus !== event.status) {
      eventStatusPatches.push({
        eventId: event.id,
        remainingTransitions: newRemainingTransitions,
        toStatus: newStatus,
      });
    }
  }

  return { eventStatusPatches, logs, notifications: [] };
}
