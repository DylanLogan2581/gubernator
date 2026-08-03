// Public surface of the src/shared/simulation module.
//
// Only the notification payload parsers/types are consumed by the frontend.
// The full simulation engine lives in supabase/functions/_shared/simulation.

export { LOG_CODES } from "./logCodes.ts";
export type { LogCode } from "./logCodes.ts";

export {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingSuspendedPayload,
  parseConstructionCompletedPayload,
  parseConstructionPausedPayload,
  parseDepositDepletedPayload,
  parseManagedPopulationDecliningPayload,
  parseManagedPopulationExtinctPayload,
  parsePartnershipFormedPayload,
  parsePartnershipWidowedPayload,
  parseSettlementHomelessnessOccurredPayload,
  parseSettlementStarvationOccurredPayload,
  parseTradeRoutePausedPayload,
  parseTradeRouteResumedPayload,
} from "./outcomes/notificationPayloads.ts";
export type {
  BuildingAutoDeconstructedPayload,
  BuildingSuspendedPayload,
  ConstructionCompletedPayload,
  ConstructionPausedPayload,
  DepositDepletedPayload,
  ManagedPopulationDecliningPayload,
  ManagedPopulationExtinctPayload,
  PartnershipFormedPayload,
  PartnershipWidowedPayload,
  SettlementHomelessnessOccurredPayload,
  SettlementStarvationOccurredPayload,
  TradeRoutePausedPayload,
  TradeRouteResumedPayload,
} from "./outcomes/notificationPayloads.ts";
