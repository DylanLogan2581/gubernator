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

import {
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
} from "@/shared/simulation/outcomes/notificationPayloads";

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
  return (
    <span className="text-sm">
      Trade route paused — <em>{p.pauseReason}</em> ({p.quantityPerTransition}{" "}
      units/turn)
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
    case "building.suspended":
      return (
        <BuildingSuspendedRenderer
          isAdmin={isAdmin}
          lookup={lookup}
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
    case "deposit.depleted":
      return (
        <DepositDepletedRenderer
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
