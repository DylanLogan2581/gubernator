// Whether a turn log row's expanded view would show anything beyond its
// summary — used by the table to decide whether to render the expand
// chevron at all ("no dead expand").

import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingSuspendedPayload,
  parseCitizenConsumedFoodWaterPayload,
  parseConstructionProgressPayload,
  parseDepositProcessedPayload,
} from "@/shared/simulation/outcomes/notificationPayloads";

export function hasMeaningfulPayload(payload: unknown): boolean {
  if (payload === null || typeof payload !== "object") return false;
  return Object.keys(payload).length > 0;
}

export function isTurnLogRowExpandable(
  logCategory: string,
  payload: unknown,
  isAdmin: boolean,
): boolean {
  switch (logCategory) {
    case "building.auto_deconstructed":
      return parseBuildingAutoDeconstructedPayload(payload) !== null;
    case "building.suspended":
      return parseBuildingSuspendedPayload(payload) !== null;
    case "citizen.consumed_food_water":
      return parseCitizenConsumedFoodWaterPayload(payload) !== null;
    case "construction.progress":
      return parseConstructionProgressPayload(payload) !== null;
    case "deposit.processed":
      return parseDepositProcessedPayload(payload) !== null;
    // These typed categories already show everything the payload has in
    // their summary — nothing more to reveal on expand.
    case "building.recovered":
    case "citizen.born":
    case "citizen.died_homeless":
    case "citizen.starved":
    case "construction.completed":
    case "construction.paused":
    case "deposit.depleted":
    case "event.building_destroyed":
    case "event.consumption_multiplier":
    case "event.deposit_discovered":
    case "event.deposit_destroyed":
    case "event.managed_population_change":
    case "event.population_boost":
    case "event.population_loss":
    case "event.production_multiplier":
    case "event.resource_drain":
    case "event.resource_grant":
    case "event.upkeep_multiplier":
    case "managed_population.declining":
    case "managed_population.extinct":
    case "manual_deconstruct_overshoot":
    case "partnership.formed":
    case "partnership.widowed":
    case "passive_effect.applied":
    case "settlement.starvation_occurred":
    case "settlement.homelessness_occurred":
    case "stockpile.clamped":
    case "stockpile.changed":
    case "trade_route.paused":
    case "trade_route.resumed":
      return false;
    default:
      return isAdmin && hasMeaningfulPayload(payload);
  }
}
