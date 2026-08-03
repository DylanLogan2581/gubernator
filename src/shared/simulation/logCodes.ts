// Single source of truth for simulation turn-log category codes.
//
// The edge simulation phases emit these codes on log entries; the client keys
// its filter dropdown, label map, and construction filter on the same union so
// a newly emitted code can't silently vanish from the UI. Add a code here and
// the client label map fails to type-check until it is labeled.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export const LOG_CODES = [
  "basic_turn_advancement",
  "building.auto_deconstructed",
  "building.recovered",
  "building.suspended",
  "citizen.born",
  "citizen.consumed_food_water",
  "citizen.died_homeless",
  "citizen.starved",
  "construction.completed",
  "construction.paused",
  "construction.progress",
  "deposit.depleted",
  "deposit.processed",
  "event.building_destroyed",
  "event.consumption_multiplier",
  "event.deposit_discovered",
  "event.deposit_destroyed",
  "event.managed_population_change",
  "event.population_boost",
  "event.population_loss",
  "event.production_multiplier",
  "event.resource_drain",
  "event.resource_grant",
  "event.upkeep_multiplier",
  "homeless",
  "managed_population.declining",
  "managed_population.extinct",
  "manual_deconstruct_overshoot",
  "partnership.formed",
  "partnership.widowed",
  "passive_effect.applied",
  "settlement.homelessness_occurred",
  "settlement.starvation_occurred",
  "standard_job.processed",
  "starvation",
  "stockpile.clamped",
  "stockpile.changed",
  "tampered",
  "trade_route.paused",
  "trade_route.resumed",
] as const;

export type LogCode = (typeof LOG_CODES)[number];
