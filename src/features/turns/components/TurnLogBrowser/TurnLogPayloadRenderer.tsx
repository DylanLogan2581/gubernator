// Per-category payload renderers for turn_log_entries.
//
// Each known log_category has a typed renderer that parses the payload using
// the same parsers as supabase/functions/_shared/simulation/outcomes/notificationPayloads.ts.
// Unknown categories fall back to a raw-JSON collapsible.

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

import type { JSX } from "react";

// ---------------------------------------------------------------------------
// Raw-JSON fallback
// ---------------------------------------------------------------------------

function RawJsonFallback({
  category,
  payload,
}: {
  readonly category: string;
  readonly payload: unknown;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line no-restricted-syntax
  const json = JSON.stringify(payload, null, 2);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          <Badge variant="outline" className="font-mono text-xs">
            {category}
          </Badge>
        </span>
        {json !== "{}" && json !== "null" ? (
          <CollapsibleTrigger
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-expanded={open}
          >
            {open ? "hide payload" : "show payload"}
          </CollapsibleTrigger>
        ) : null}
      </div>
      <CollapsibleContent>
        <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
          {json}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Typed renderers
// ---------------------------------------------------------------------------

function BuildingAutoDeconstructedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseBuildingAutoDeconstructedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="building.auto_deconstructed"
        payload={payload}
      />
    );
  return (
    <span className="text-sm">
      Building auto-deconstructed after <strong>{p.missedUpkeepCount}</strong>{" "}
      missed upkeeps (grace: {p.gracePeriodTurns} turns)
    </span>
  );
}

function BuildingSuspendedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseBuildingSuspendedPayload(payload);
  if (p === null)
    return <RawJsonFallback category="building.suspended" payload={payload} />;
  return (
    <span className="text-sm">
      Building suspended after <strong>{p.missedUpkeepCount}</strong> missed
      upkeeps
    </span>
  );
}

function ConstructionCompletedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseConstructionCompletedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback category="construction.completed" payload={payload} />
    );
  return (
    <span className="text-sm">
      Construction completed with <strong>{p.workers}</strong> workers
    </span>
  );
}

function ConstructionPausedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseConstructionPausedPayload(payload);
  if (p === null)
    return <RawJsonFallback category="construction.paused" payload={payload} />;
  return (
    <span className="text-sm">
      Construction paused (<strong>{p.workers}</strong> workers assigned)
    </span>
  );
}

function DepositDepletedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseDepositDepletedPayload(payload);
  if (p === null)
    return <RawJsonFallback category="deposit.depleted" payload={payload} />;
  return (
    <span className="text-sm">
      Deposit <strong>{p.depositName}</strong> depleted
    </span>
  );
}

function ManagedPopulationDecliningRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseManagedPopulationDecliningPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="managed_population.declining"
        payload={payload}
      />
    );
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
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseManagedPopulationExtinctPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="managed_population.extinct"
        payload={payload}
      />
    );
  return (
    <span className="text-sm">
      Population <strong>{p.name}</strong> has gone extinct
    </span>
  );
}

function PartnershipFormedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parsePartnershipFormedPayload(payload);
  if (p === null)
    return <RawJsonFallback category="partnership.formed" payload={payload} />;
  return (
    <span className="text-sm font-mono text-xs">
      Partnership formed: {p.citizenAId.slice(0, 8)}… &amp;{" "}
      {p.citizenBId.slice(0, 8)}…
    </span>
  );
}

function PartnershipWidowedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parsePartnershipWidowedPayload(payload);
  if (p === null)
    return <RawJsonFallback category="partnership.widowed" payload={payload} />;
  return (
    <span className="text-sm">
      Citizen{" "}
      <span className="font-mono text-xs">
        {p.survivingCitizenId.slice(0, 8)}…
      </span>{" "}
      widowed
    </span>
  );
}

function SettlementStarvationOccurredRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseSettlementStarvationOccurredPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="settlement.starvation_occurred"
        payload={payload}
      />
    );
  return <span className="text-sm">Starvation deaths occurred this turn</span>;
}

function SettlementHomelessnessOccurredRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseSettlementHomelessnessOccurredPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="settlement.homelessness_occurred"
        payload={payload}
      />
    );
  return (
    <span className="text-sm">Homelessness deaths occurred this turn</span>
  );
}

function TradeRoutePausedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseTradeRoutePausedPayload(payload);
  if (p === null)
    return <RawJsonFallback category="trade_route.paused" payload={payload} />;
  return (
    <span className="text-sm">
      Trade route paused — <em>{p.pauseReason}</em> ({p.quantityPerTransition}{" "}
      units/turn)
    </span>
  );
}

function TradeRouteResumedRenderer({
  payload,
}: {
  readonly payload: unknown;
}): JSX.Element {
  const p = parseTradeRouteResumedPayload(payload);
  if (p === null)
    return <RawJsonFallback category="trade_route.resumed" payload={payload} />;
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
  readonly logCategory: string;
  readonly payload: unknown;
};

export function TurnLogPayloadRenderer({
  logCategory,
  payload,
}: TurnLogPayloadRendererProps): JSX.Element {
  switch (logCategory) {
    case "building.auto_deconstructed":
      return <BuildingAutoDeconstructedRenderer payload={payload} />;
    case "building.suspended":
      return <BuildingSuspendedRenderer payload={payload} />;
    case "construction.completed":
      return <ConstructionCompletedRenderer payload={payload} />;
    case "construction.paused":
      return <ConstructionPausedRenderer payload={payload} />;
    case "deposit.depleted":
      return <DepositDepletedRenderer payload={payload} />;
    case "managed_population.declining":
      return <ManagedPopulationDecliningRenderer payload={payload} />;
    case "managed_population.extinct":
      return <ManagedPopulationExtinctRenderer payload={payload} />;
    case "partnership.formed":
      return <PartnershipFormedRenderer payload={payload} />;
    case "partnership.widowed":
      return <PartnershipWidowedRenderer payload={payload} />;
    case "settlement.starvation_occurred":
      return <SettlementStarvationOccurredRenderer payload={payload} />;
    case "settlement.homelessness_occurred":
      return <SettlementHomelessnessOccurredRenderer payload={payload} />;
    case "trade_route.paused":
      return <TradeRoutePausedRenderer payload={payload} />;
    case "trade_route.resumed":
      return <TradeRouteResumedRenderer payload={payload} />;
    default:
      return <RawJsonFallback category={logCategory} payload={payload} />;
  }
}
