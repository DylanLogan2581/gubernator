// Per-category payload renderers for turn_log_entries.
//
// Each known log_category has a typed table entry that parses the payload using
// the same parsers as supabase/functions/_shared/simulation/outcomes/notificationPayloads.ts
// and renders the parsed value. Unknown categories — and payloads that fail to
// parse — fall back to a raw-JSON view (admins only). The generic
// TurnLogPayloadRenderer wrapper owns the null → RawJsonFallback path so each
// table entry only expresses the happy-path rendering.
//
// Entries take a `mode`: "summary" (the collapsed row's one-liner) or
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
  parseStockpileChangedPayload,
  parseTradeRoutePausedPayload,
  parseTradeRouteResumedPayload,
} from "@/shared/simulation/outcomes/notificationPayloads";

import { formatResourceDeltas } from "../../utils/formatResourceDeltas";
import { hasMeaningfulPayload } from "../../utils/isTurnLogRowExpandable";

import { EntityRef } from "./EntityRef";

import type { TurnLogEntityLookup } from "../../hooks/useTurnLogEntityLookup";
import type { JSX, ReactNode } from "react";

export type TurnLogPayloadRendererMode = "summary" | "expanded";

// ---------------------------------------------------------------------------
// Raw-JSON fallback (unknown categories, unparseable payloads)
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
// Category lookup table
// ---------------------------------------------------------------------------

type RenderContext = {
  readonly lookup: TurnLogEntityLookup;
  readonly mode: TurnLogPayloadRendererMode;
};

// A category entry parses the raw payload to a category-specific shape and, when
// that succeeds, renders it. `parse` returning null routes through
// RawJsonFallback in the wrapper below. The two callbacks are tied together by
// the type parameter of `defineRenderer`; the erased `CategoryRenderer` type is
// what the table stores, so the wrapper can treat every entry uniformly.
type CategoryRenderer = {
  readonly parse: (payload: unknown) => unknown;
  readonly render: (parsed: never, ctx: RenderContext) => ReactNode;
};

function defineRenderer<T>(entry: {
  readonly parse: (payload: unknown) => T | null;
  readonly render: (parsed: T, ctx: RenderContext) => ReactNode;
}): CategoryRenderer {
  return entry;
}

const CATEGORY_RENDERERS: Record<string, CategoryRenderer> = {
  "building.auto_deconstructed": defineRenderer({
    parse: parseBuildingAutoDeconstructedPayload,
    render: (p, { lookup, mode }) => {
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
            auto-deconstructed after <strong>{p.missedUpkeepCount}</strong>{" "}
            missed upkeeps
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
            auto-deconstructed after <strong>{p.missedUpkeepCount}</strong>{" "}
            missed upkeeps
          </div>
          <div className="text-muted-foreground">
            Blueprint: {building.blueprintName ?? "Unknown blueprint"} · Grace
            period: {p.gracePeriodTurns} turns
          </div>
        </div>
      );
    },
  }),
  "building.recovered": defineRenderer({
    parse: parseBuildingRecoveredPayload,
    render: (p, { lookup }) => {
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
    },
  }),
  "building.suspended": defineRenderer({
    parse: parseBuildingSuspendedPayload,
    render: (p, { lookup, mode }) => {
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
            suspended after <strong>{p.missedUpkeepCount}</strong> missed
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
            suspended after <strong>{p.missedUpkeepCount}</strong> missed
            upkeeps
          </div>
          <div className="text-muted-foreground">
            Blueprint: {building.blueprintName ?? "Unknown blueprint"}
          </div>
        </div>
      );
    },
  }),
  "citizen.born": defineRenderer({
    parse: parseCitizenBornPayload,
    render: (p, { lookup }) => {
      const parentA = lookup.citizen(p.parentACitizenId);
      const parentB = lookup.citizen(p.parentBCitizenId);
      return (
        <span className="text-sm">
          Child born to{" "}
          <EntityRef
            name={parentA.name}
            href={parentA.href}
            kindLabel="Citizen"
          />{" "}
          &amp;{" "}
          <EntityRef
            name={parentB.name}
            href={parentB.href}
            kindLabel="Citizen"
          />
        </span>
      );
    },
  }),
  "citizen.consumed_food_water": defineRenderer({
    parse: parseCitizenConsumedFoodWaterPayload,
    render: (p, { mode }) => {
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
    },
  }),
  "citizen.died_homeless": defineRenderer({
    parse: parseCitizenDiedHomelessPayload,
    render: (p) => (
      <span className="text-sm">Died homeless — {p.deathDetail}</span>
    ),
  }),
  "citizen.starved": defineRenderer({
    parse: parseCitizenStarvedPayload,
    render: (p) => (
      <span className="text-sm">Died of starvation — {p.deathDetail}</span>
    ),
  }),
  "construction.completed": defineRenderer({
    parse: parseConstructionCompletedPayload,
    render: (p) => (
      <span className="text-sm">
        Construction completed with <strong>{p.workers}</strong> workers
      </span>
    ),
  }),
  "construction.paused": defineRenderer({
    parse: parseConstructionPausedPayload,
    render: (p) => (
      <span className="text-sm">
        Construction paused (<strong>{p.workers}</strong> workers assigned)
      </span>
    ),
  }),
  "construction.progress": defineRenderer({
    parse: parseConstructionProgressPayload,
    render: (p, { lookup, mode }) => {
      const percent =
        p.workerTurnsRequired > 0
          ? Math.round((p.newProgress / p.workerTurnsRequired) * 100)
          : 0;
      const summary = (
        <span className="text-sm">
          Construction progress: <strong>{percent}%</strong> ({p.workers}{" "}
          workers)
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
    },
  }),
  "deposit.depleted": defineRenderer({
    parse: parseDepositDepletedPayload,
    render: (p) => (
      <span className="text-sm">
        Deposit <strong>{p.depositName}</strong> depleted
      </span>
    ),
  }),
  "deposit.processed": defineRenderer({
    parse: parseDepositProcessedPayload,
    render: (p, { lookup, mode }) => {
      const summary = (
        <span className="text-sm">
          Deposit processed: <strong>{Math.round(p.totalExtraction)}</strong>{" "}
          extracted ({p.workers} workers)
        </span>
      );
      if (mode === "summary") return summary;
      const extracted = formatResourceDeltas(
        p.extractedByResource,
        "+",
        lookup,
      );
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
    },
  }),
  "event.building_destroyed": defineRenderer({
    parse: parseEventBuildingDestroyedPayload,
    render: (p, { lookup }) => {
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
    },
  }),
  "event.consumption_multiplier": defineRenderer({
    parse: parseEventConsumptionMultiplierPayload,
    render: (p) => (
      <span className="text-sm">
        Event: consumption ×<strong>{p.multiplier}</strong>
      </span>
    ),
  }),
  "event.deposit_discovered": defineRenderer({
    parse: parseEventDepositDiscoveredPayload,
    render: () => (
      <span className="text-sm">Event: new deposit discovered</span>
    ),
  }),
  "event.deposit_destroyed": defineRenderer({
    parse: parseEventDepositDestroyedPayload,
    render: (p) => {
      if ("destroyedCount" in p) {
        return (
          <span className="text-sm">
            Event: <strong>{p.destroyedCount}</strong> deposits destroyed
          </span>
        );
      }
      return <span className="text-sm">Event: deposit destroyed</span>;
    },
  }),
  "event.managed_population_change": defineRenderer({
    parse: parseEventManagedPopulationChangePayload,
    render: (p) => {
      const sign = p.delta >= 0 ? "+" : "";
      return (
        <span className="text-sm">
          Event: managed population change ({sign}
          {p.delta})
        </span>
      );
    },
  }),
  "event.population_boost": defineRenderer({
    parse: parseEventPopulationBoostPayload,
    render: (p) => (
      <span className="text-sm">
        Event: population boost +<strong>{p.amount}</strong> (now{" "}
        {p.citizenCount})
      </span>
    ),
  }),
  "event.population_loss": defineRenderer({
    parse: parseEventPopulationLossPayload,
    render: (p) => (
      <span className="text-sm">
        Event: population loss -<strong>{p.amount}</strong> (now{" "}
        {p.citizenCount})
      </span>
    ),
  }),
  "event.production_multiplier": defineRenderer({
    parse: parseEventProductionMultiplierPayload,
    render: (p) => (
      <span className="text-sm">
        Event: production ×<strong>{p.multiplier}</strong>
      </span>
    ),
  }),
  "event.resource_drain": defineRenderer({
    parse: parseEventResourceDrainPayload,
    render: (p, { lookup }) => {
      const resourceName =
        lookup.resourceName(p.resourceId) ?? "Unknown resource";
      return (
        <span className="text-sm">
          Event: resource drain -<strong>{Math.round(p.amount)}</strong>{" "}
          {resourceName}
        </span>
      );
    },
  }),
  "event.resource_grant": defineRenderer({
    parse: parseEventResourceGrantPayload,
    render: (p, { lookup }) => {
      const resourceName =
        lookup.resourceName(p.resourceId) ?? "Unknown resource";
      return (
        <span className="text-sm">
          Event: resource grant +<strong>{Math.round(p.amount)}</strong>{" "}
          {resourceName}
        </span>
      );
    },
  }),
  "event.upkeep_multiplier": defineRenderer({
    parse: parseEventUpkeepMultiplierPayload,
    render: (p) => (
      <span className="text-sm">
        Event: upkeep ×<strong>{p.multiplier}</strong>
      </span>
    ),
  }),
  "managed_population.declining": defineRenderer({
    parse: parseManagedPopulationDecliningPayload,
    render: (p) => {
      const husbandry = Math.round(p.husbandryCoverage * 100);
      const maintenance = Math.round(p.maintenanceCoverage * 100);
      return (
        <span className="text-sm">
          Population <strong>{p.name}</strong> declining — husbandry:{" "}
          {husbandry}
          %, maintenance: {maintenance}%
        </span>
      );
    },
  }),
  "managed_population.extinct": defineRenderer({
    parse: parseManagedPopulationExtinctPayload,
    render: (p) => (
      <span className="text-sm">
        Population <strong>{p.name}</strong> has gone extinct
      </span>
    ),
  }),
  manual_deconstruct_overshoot: defineRenderer({
    parse: parseManualDeconstructOvershootPayload,
    render: (p, { lookup }) => {
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
    },
  }),
  "partnership.formed": defineRenderer({
    parse: parsePartnershipFormedPayload,
    render: (p, { lookup }) => {
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
    },
  }),
  "partnership.widowed": defineRenderer({
    parse: parsePartnershipWidowedPayload,
    render: (p, { lookup }) => {
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
    },
  }),
  "passive_effect.applied": defineRenderer({
    parse: parsePassiveEffectAppliedPayload,
    render: (p, { lookup }) => {
      const building = lookup.building(p.buildingId);
      const resourceName =
        lookup.resourceName(p.resourceId) ?? "Unknown resource";
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
    },
  }),
  "settlement.starvation_occurred": defineRenderer({
    parse: parseSettlementStarvationOccurredPayload,
    render: () => (
      <span className="text-sm">Starvation deaths occurred this turn</span>
    ),
  }),
  "settlement.homelessness_occurred": defineRenderer({
    parse: parseSettlementHomelessnessOccurredPayload,
    render: () => (
      <span className="text-sm">Homelessness deaths occurred this turn</span>
    ),
  }),
  "stockpile.clamped": defineRenderer({
    parse: parseStockpileClampedPayload,
    render: (p, { lookup }) => {
      const resourceName =
        lookup.resourceName(p.resourceId) ?? "Unknown resource";
      const reasonLabel = p.reason === "negative" ? "below zero" : "over cap";
      return (
        <span className="text-sm">
          {resourceName} stockpile clamped ({reasonLabel}): {Math.round(p.pre)}{" "}
          → <strong>{Math.round(p.post)}</strong>
        </span>
      );
    },
  }),
  "stockpile.changed": defineRenderer({
    parse: parseStockpileChangedPayload,
    render: (p, { lookup }) => {
      const resourceName =
        lookup.resourceName(p.resourceId) ?? "Unknown resource";
      const verb = p.delta >= 0 ? "grew" : "decayed";
      return (
        <span className="text-sm">
          {resourceName} stockpile {verb}: {Math.round(p.pre)} →{" "}
          <strong>{Math.round(p.post)}</strong>
        </span>
      );
    },
  }),
  "trade_route.paused": defineRenderer({
    parse: parseTradeRoutePausedPayload,
    render: (p, { lookup }) => {
      const pauseReasonLabel =
        PAUSE_REASON_LABELS[p.pauseReason] ?? p.pauseReason;
      const resourceName =
        p.resourceId === null
          ? null
          : (lookup.resourceName(p.resourceId) ?? "Unknown resource");
      return (
        <span className="text-sm">
          Trade route paused — <em>{pauseReasonLabel}</em>
          {resourceName !== null && p.quantityPerTransition !== null
            ? ` (${resourceName}, ${p.quantityPerTransition} units/turn)`
            : null}
        </span>
      );
    },
  }),
  "trade_route.resumed": defineRenderer({
    parse: parseTradeRouteResumedPayload,
    render: (p) => (
      <span className="text-sm">
        Trade route resumed — <strong>{p.quantityTransferred}</strong> units
        transferred
      </span>
    ),
  }),
};

// ---------------------------------------------------------------------------
// Generic wrapper
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
  const entry = CATEGORY_RENDERERS[logCategory];
  const parsed = entry?.parse(payload) ?? null;
  if (entry === undefined || parsed === null) {
    return <RawJsonFallback isAdmin={isAdmin} mode={mode} payload={payload} />;
  }
  return <>{entry.render(parsed as never, { lookup, mode })}</>;
}
