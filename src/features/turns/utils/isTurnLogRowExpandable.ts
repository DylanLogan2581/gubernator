// Whether a turn log row's expanded view would show anything beyond its
// summary — used by the table to decide whether to render the expand
// chevron at all ("no dead expand").

import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingSuspendedPayload,
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
    // These typed categories already show everything the payload has in
    // their summary — nothing more to reveal on expand.
    case "construction.completed":
    case "construction.paused":
    case "deposit.depleted":
    case "managed_population.declining":
    case "managed_population.extinct":
    case "partnership.formed":
    case "partnership.widowed":
    case "settlement.starvation_occurred":
    case "settlement.homelessness_occurred":
    case "trade_route.paused":
    case "trade_route.resumed":
      return false;
    default:
      return isAdmin && hasMeaningfulPayload(payload);
  }
}
