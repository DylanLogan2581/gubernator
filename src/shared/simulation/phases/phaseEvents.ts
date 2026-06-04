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

  let skippedCount = 0;

  for (const event of events) {
    if (event.status !== "pending" && event.status !== "active") continue;
    if (event.activateOnTransitionAfterTurnNumber > turnNumber) continue;

    const effectType: EventEffectType = event.effectType;
    switch (effectType) {
      case "deposit_discovered":
      case "population_loss":
      case "resource_grant":
        // No-op: Epic 7 implements effect resolution for each case.
        skippedCount++;
        break;
      default: {
        const _: never = effectType;
        void _;
        break;
      }
    }
  }

  const logs: SimulationLogEntry[] = [];
  if (skippedCount > 0) {
    logs.push({
      category: "event.skipped",
      payload: { count: skippedCount, reason: "epic-7-pending" },
      phase: "events",
    });
  }

  return { logs, notifications: [] };
}
