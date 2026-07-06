// Per-category payload renderers for turn_log_entries.
//
// Each known log_category has a typed renderer that parses the payload using
// the same parsers as supabase/functions/_shared/simulation/outcomes/notificationPayloads.ts.
// Unknown categories fall back to a raw-JSON view (admins only).
//
// Renderers take a `mode`: "summary" (the collapsed row's one-liner) or
// "expanded" (the detail row shown when the table's chevron is toggled open).
// The expanded view must always add information beyond the summary —
// `isTurnLogRowExpandable` tells the table when there's nothing more to show
// so it can skip the chevron entirely ("no dead expand").

import { PAUSE_REASON_LABELS } from "@/features/trade";
import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingRecoveredPayload,
  parseBuildingSuspendedPayload,
  parseCitizenBornPayload,
  parseCitizenConsumedFoodWaterPayload,
  parseCitizenDiedHomelessPayload,
  parseCitizenStarvedPayload,
  parseConstructionCompletedPayload,
  parseConstructionPausedPayload,
  parseConstructionProgressPayload,
  parseDepositDepletedPayload,
  parseDepositProcessedPayload,
  parseEventBuildingDestroyedPayload,
  parseEventConsumptionMultiplierPayload,
  parseEventDepositDestroyedPayload,
  parseEventDepositDiscoveredPayload,
  parseEventManagedPopulationChangePayload,
  parseEventPopulationBoostPayload,
  parseEventPopulationLossPayload,
  parseEventProductionMultiplierPayload,
  parseEventResourceDrainPayload,
  parseEventResourceGrantPayload,
  parseEventUpkeepMultiplierPayload,
  parseManagedPopulationDecliningPayload,
  parseManagedPopulationExtinctPayload,
  parseManualDeconstructOvershootPayload,
  parsePartnershipFormedPayload,
  parsePartnershipWidowedPayload,
  parsePassiveEffectAppliedPayload,
  parseSettlementHomelessnessOccurredPayload,
  parseSettlementStarvationOccurredPayload,
  parseStockpileClampedPayload,
  parseStockpileDecayedPayload,
  parseTradeRoutePausedPayload,
  parseTradeRouteResumedPayload,
} from "@/shared/simulation/outcomes/notificationPayloads";

import { formatResourceDeltas } from "../../utils/formatResourceDeltas";
import { hasMeaningfulPayload } from "../../utils/isTurnLogRowExpandable";

import { EntityRef } from "./EntityRef";

import type { TurnLogEntityLookup } from "../../hooks/useTurnLogEntityLookup";
import type { JSX } from "react";

export type TurnLogPayloadRendererMode = "summary" | "expanded";

// ---------------------------------------------------------------------------
// Raw-JSON fallback (unknown categories)
// ---------------------------------------------------------------------------

function RawJsonFallback({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  if (mode === "summary") {
    // The Category column already shows the badge — nothing more to say
    // here without an admin explicitly expanding the row.
    return <span className="text-muted-foreground">—</span>;
  }

  if (!isAdmin || !hasMeaningfulPayload(payload)) {
    return <span className="text-muted-foreground">No further detail</span>;
  }

  // eslint-disable-next-line no-restricted-syntax
  const json = JSON.stringify(payload, null, 2);
  return (
    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{json}</pre>
  );
}

// ---------------------------------------------------------------------------
// Typed renderers
// ---------------------------------------------------------------------------

function BuildingAutoDeconstructedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseBuildingAutoDeconstructedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const building = lookup.building(p.buildingId);

  if (mode === "summary") {
    return (
      <span className="text-sm">
        Building{" "}
        <EntityRef
          name={building.name}
          href={building.href}
          kindLabel="Building"
        />{" "}
        auto-deconstructed after <strong>{p.missedUpkeepCount}</strong> missed
        upkeeps
      </span>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      <div>
        Building{" "}
        <EntityRef
          name={building.name}
          href={building.href}
          kindLabel="Building"
        />{" "}
        auto-deconstructed after <strong>{p.missedUpkeepCount}</strong> missed
        upkeeps
      </div>
      <div className="text-muted-foreground">
        Blueprint: {building.blueprintName ?? "Unknown blueprint"} · Grace
        period: {p.gracePeriodTurns} turns
      </div>
    </div>
  );
}

function BuildingSuspendedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseBuildingSuspendedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const building = lookup.building(p.buildingId);

  if (mode === "summary") {
    return (
      <span className="text-sm">
        Building{" "}
        <EntityRef
          name={building.name}
          href={building.href}
          kindLabel="Building"
        />{" "}
        suspended after <strong>{p.missedUpkeepCount}</strong> missed upkeeps
      </span>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      <div>
        Building{" "}
        <EntityRef
          name={building.name}
          href={building.href}
          kindLabel="Building"
        />{" "}
        suspended after <strong>{p.missedUpkeepCount}</strong> missed upkeeps
      </div>
      <div className="text-muted-foreground">
        Blueprint: {building.blueprintName ?? "Unknown blueprint"}
      </div>
    </div>
  );
}

function ConstructionCompletedRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseConstructionCompletedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Construction completed with <strong>{p.workers}</strong> workers
    </span>
  );
}

function ConstructionPausedRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseConstructionPausedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Construction paused (<strong>{p.workers}</strong> workers assigned)
    </span>
  );
}

function DepositDepletedRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseDepositDepletedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Deposit <strong>{p.depositName}</strong> depleted
    </span>
  );
}

function ManagedPopulationDecliningRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseManagedPopulationDecliningPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const husbandry = Math.round(p.husbandryCoverage * 100);
  const maintenance = Math.round(p.maintenanceCoverage * 100);
  return (
    <span className="text-sm">
      Population <strong>{p.name}</strong> declining — husbandry: {husbandry}%,
      maintenance: {maintenance}%
    </span>
  );
}

function ManagedPopulationExtinctRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseManagedPopulationExtinctPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Population <strong>{p.name}</strong> has gone extinct
    </span>
  );
}

function PartnershipFormedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parsePartnershipFormedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const citizenA = lookup.citizen(p.citizenAId);
  const citizenB = lookup.citizen(p.citizenBId);
  return (
    <span className="text-sm">
      Partnership formed:{" "}
      <EntityRef
        name={citizenA.name}
        href={citizenA.href}
        kindLabel="Citizen"
      />{" "}
      &amp;{" "}
      <EntityRef
        name={citizenB.name}
        href={citizenB.href}
        kindLabel="Citizen"
      />
    </span>
  );
}

function PartnershipWidowedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parsePartnershipWidowedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const survivor = lookup.citizen(p.survivingCitizenId);
  return (
    <span className="text-sm">
      <EntityRef
        name={survivor.name}
        href={survivor.href}
        kindLabel="Citizen"
      />{" "}
      widowed
    </span>
  );
}

function SettlementStarvationOccurredRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseSettlementStarvationOccurredPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return <span className="text-sm">Starvation deaths occurred this turn</span>;
}

function SettlementHomelessnessOccurredRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseSettlementHomelessnessOccurredPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">Homelessness deaths occurred this turn</span>
  );
}

function TradeRoutePausedRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseTradeRoutePausedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const pauseReasonLabel = PAUSE_REASON_LABELS[p.pauseReason] ?? p.pauseReason;
  return (
    <span className="text-sm">
      Trade route paused — <em>{pauseReasonLabel}</em> (
      {p.quantityPerTransition} units/turn)
    </span>
  );
}

function TradeRouteResumedRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseTradeRouteResumedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Trade route resumed — <strong>{p.quantityTransferred}</strong> units
      transferred
    </span>
  );
}

function BuildingRecoveredRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseBuildingRecoveredPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const building = lookup.building(p.buildingId);
  return (
    <span className="text-sm">
      Building{" "}
      <EntityRef
        name={building.name}
        href={building.href}
        kindLabel="Building"
      />{" "}
      recovered from suspension
    </span>
  );
}

function CitizenBornRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseCitizenBornPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const parentA = lookup.citizen(p.parentACitizenId);
  const parentB = lookup.citizen(p.parentBCitizenId);
  return (
    <span className="text-sm">
      Child born to{" "}
      <EntityRef name={parentA.name} href={parentA.href} kindLabel="Citizen" />{" "}
      &amp;{" "}
      <EntityRef name={parentB.name} href={parentB.href} kindLabel="Citizen" />
    </span>
  );
}

function CitizenConsumedFoodWaterRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseCitizenConsumedFoodWaterPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const summary = (
    <span className="text-sm">
      <strong>{p.aliveCount}</strong> citizens consumed{" "}
      {Math.round(p.foodConsumed)}/{Math.round(p.foodRequired)} food,{" "}
      {Math.round(p.waterConsumed)}/{Math.round(p.waterRequired)} water
    </span>
  );
  if (mode === "summary") return summary;
  return (
    <div className="space-y-1 text-sm">
      <div>{summary}</div>
      <div className="text-muted-foreground">
        Stock remaining — food: {Math.round(p.foodStock)}, water:{" "}
        {Math.round(p.waterStock)}
      </div>
    </div>
  );
}

function CitizenDiedHomelessRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseCitizenDiedHomelessPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return <span className="text-sm">Died homeless — {p.deathDetail}</span>;
}

function CitizenStarvedRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseCitizenStarvedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return <span className="text-sm">Died of starvation — {p.deathDetail}</span>;
}

function ConstructionProgressRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseConstructionProgressPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const percent =
    p.workerTurnsRequired > 0
      ? Math.round((p.newProgress / p.workerTurnsRequired) * 100)
      : 0;
  const summary = (
    <span className="text-sm">
      Construction progress: <strong>{percent}%</strong> ({p.workers} workers)
    </span>
  );
  if (mode === "summary") return summary;
  const costs = formatResourceDeltas(p.costsDeducted, "-", lookup);
  return (
    <div className="space-y-1 text-sm">
      <div>{summary}</div>
      {costs !== "" ? (
        <div className="text-muted-foreground">Costs deducted: {costs}</div>
      ) : null}
    </div>
  );
}

function DepositProcessedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseDepositProcessedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const summary = (
    <span className="text-sm">
      Deposit processed: <strong>{Math.round(p.totalExtraction)}</strong>{" "}
      extracted ({p.workers} workers)
    </span>
  );
  if (mode === "summary") return summary;
  const extracted = formatResourceDeltas(p.extractedByResource, "+", lookup);
  const consumed = formatResourceDeltas(p.inputsConsumed, "-", lookup);
  return (
    <div className="space-y-1 text-sm">
      <div>{summary}</div>
      {extracted !== "" ? (
        <div className="text-muted-foreground">Extracted: {extracted}</div>
      ) : null}
      {consumed !== "" ? (
        <div className="text-muted-foreground">Consumed: {consumed}</div>
      ) : null}
    </div>
  );
}

function EventBuildingDestroyedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventBuildingDestroyedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const building = lookup.building(p.settlementBuildingId);
  return (
    <span className="text-sm">
      Event: Building{" "}
      <EntityRef
        name={building.name}
        href={building.href}
        kindLabel="Building"
      />{" "}
      destroyed
    </span>
  );
}

function EventConsumptionMultiplierRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventConsumptionMultiplierPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Event: consumption ×<strong>{p.multiplier}</strong>
    </span>
  );
}

function EventDepositDiscoveredRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventDepositDiscoveredPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return <span className="text-sm">Event: new deposit discovered</span>;
}

function EventDepositDestroyedRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventDepositDestroyedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  if ("destroyedCount" in p) {
    return (
      <span className="text-sm">
        Event: <strong>{p.destroyedCount}</strong> deposits destroyed
      </span>
    );
  }
  return <span className="text-sm">Event: deposit destroyed</span>;
}

function EventManagedPopulationChangeRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventManagedPopulationChangePayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const sign = p.delta >= 0 ? "+" : "";
  return (
    <span className="text-sm">
      Event: managed population change ({sign}
      {p.delta})
    </span>
  );
}

function EventPopulationBoostRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventPopulationBoostPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Event: population boost +<strong>{p.amount}</strong> (now {p.citizenCount}
      )
    </span>
  );
}

function EventPopulationLossRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventPopulationLossPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Event: population loss -<strong>{p.amount}</strong> (now {p.citizenCount})
    </span>
  );
}

function EventProductionMultiplierRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventProductionMultiplierPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Event: production ×<strong>{p.multiplier}</strong>
    </span>
  );
}

function EventResourceDrainRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventResourceDrainPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const resourceName = lookup.resourceName(p.resourceId) ?? "Unknown resource";
  return (
    <span className="text-sm">
      Event: resource drain -<strong>{Math.round(p.amount)}</strong>{" "}
      {resourceName}
    </span>
  );
}

function EventResourceGrantRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventResourceGrantPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const resourceName = lookup.resourceName(p.resourceId) ?? "Unknown resource";
  return (
    <span className="text-sm">
      Event: resource grant +<strong>{Math.round(p.amount)}</strong>{" "}
      {resourceName}
    </span>
  );
}

function EventUpkeepMultiplierRenderer({
  isAdmin,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseEventUpkeepMultiplierPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return (
    <span className="text-sm">
      Event: upkeep ×<strong>{p.multiplier}</strong>
    </span>
  );
}

function ManualDeconstructOvershootRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseManualDeconstructOvershootPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const building = lookup.building(p.settlementBuildingId);
  return (
    <span className="text-sm">
      Manual deconstruct overshoot on{" "}
      <EntityRef
        name={building.name}
        href={building.href}
        kindLabel="Building"
      />{" "}
      — <strong>{p.currentCitizens}</strong> citizens over cap of {p.newCap}
    </span>
  );
}

function PassiveEffectAppliedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parsePassiveEffectAppliedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const building = lookup.building(p.buildingId);
  const resourceName = lookup.resourceName(p.resourceId) ?? "Unknown resource";
  return (
    <span className="text-sm">
      Passive effect on{" "}
      <EntityRef
        name={building.name}
        href={building.href}
        kindLabel="Building"
      />
      :{" "}
      <strong>
        {p.amount >= 0 ? "+" : ""}
        {Math.round(p.amount)}
      </strong>{" "}
      {resourceName}
    </span>
  );
}

function StockpileClampedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseStockpileClampedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const resourceName = lookup.resourceName(p.resourceId) ?? "Unknown resource";
  const reasonLabel = p.reason === "negative" ? "below zero" : "over cap";
  return (
    <span className="text-sm">
      {resourceName} stockpile clamped ({reasonLabel}): {Math.round(p.pre)} →{" "}
      <strong>{Math.round(p.post)}</strong>
    </span>
  );
}

function StockpileDecayedRenderer({
  isAdmin,
  lookup,
  mode,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseStockpileDecayedPayload(payload);
  if (p === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  const resourceName = lookup.resourceName(p.resourceId) ?? "Unknown resource";
  return (
    <span className="text-sm">
      {resourceName} stockpile decayed: {Math.round(p.pre)} →{" "}
      <strong>{Math.round(p.post)}</strong>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

type TurnLogPayloadRendererProps = {
  readonly isAdmin?: boolean;
  readonly logCategory: string;
  readonly lookup: TurnLogEntityLookup;
  readonly mode?: TurnLogPayloadRendererMode;
  readonly payload: unknown;
};

export function TurnLogPayloadRenderer({
  isAdmin = false,
  logCategory,
  lookup,
  mode = "summary",
  payload,
}: TurnLogPayloadRendererProps): JSX.Element {
  switch (logCategory) {
    case "building.auto_deconstructed":
      return (
        <BuildingAutoDeconstructedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "building.recovered":
      return (
        <BuildingRecoveredRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "building.suspended":
      return (
        <BuildingSuspendedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "citizen.born":
      return (
        <CitizenBornRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "citizen.consumed_food_water":
      return (
        <CitizenConsumedFoodWaterRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "citizen.died_homeless":
      return (
        <CitizenDiedHomelessRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "citizen.starved":
      return (
        <CitizenStarvedRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "construction.completed":
      return (
        <ConstructionCompletedRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "construction.paused":
      return (
        <ConstructionPausedRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "construction.progress":
      return (
        <ConstructionProgressRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "deposit.depleted":
      return (
        <DepositDepletedRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "deposit.processed":
      return (
        <DepositProcessedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "event.building_destroyed":
      return (
        <EventBuildingDestroyedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "event.consumption_multiplier":
      return (
        <EventConsumptionMultiplierRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "event.deposit_discovered":
      return (
        <EventDepositDiscoveredRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "event.deposit_destroyed":
      return (
        <EventDepositDestroyedRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "event.managed_population_change":
      return (
        <EventManagedPopulationChangeRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "event.population_boost":
      return (
        <EventPopulationBoostRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "event.population_loss":
      return (
        <EventPopulationLossRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "event.production_multiplier":
      return (
        <EventProductionMultiplierRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "event.resource_drain":
      return (
        <EventResourceDrainRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "event.resource_grant":
      return (
        <EventResourceGrantRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "event.upkeep_multiplier":
      return (
        <EventUpkeepMultiplierRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "managed_population.declining":
      return (
        <ManagedPopulationDecliningRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "managed_population.extinct":
      return (
        <ManagedPopulationExtinctRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "manual_deconstruct_overshoot":
      return (
        <ManualDeconstructOvershootRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "partnership.formed":
      return (
        <PartnershipFormedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "partnership.widowed":
      return (
        <PartnershipWidowedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "passive_effect.applied":
      return (
        <PassiveEffectAppliedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "settlement.starvation_occurred":
      return (
        <SettlementStarvationOccurredRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "settlement.homelessness_occurred":
      return (
        <SettlementHomelessnessOccurredRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "stockpile.clamped":
      return (
        <StockpileClampedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "stockpile.decayed":
      return (
        <StockpileDecayedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
          mode={mode}
          payload={payload}
        />
      );
    case "trade_route.paused":
      return (
        <TradeRoutePausedRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    case "trade_route.resumed":
      return (
        <TradeRouteResumedRenderer
          isAdmin={isAdmin}
          mode={mode}
          payload={payload}
        />
      );
    default:
      return (
        <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />
      );
  }
}
