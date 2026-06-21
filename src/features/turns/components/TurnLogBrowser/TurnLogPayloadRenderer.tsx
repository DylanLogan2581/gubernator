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

import { LOG_CATEGORY_LABELS } from "../../utils/logCategoryLabels";

import type { JSX } from "react";

// ---------------------------------------------------------------------------
// Raw-JSON fallback
// ---------------------------------------------------------------------------

function RawJsonFallback({
  category,
  isAdmin,
  payload,
}: {
  readonly category: string;
  readonly isAdmin: boolean;
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
            {LOG_CATEGORY_LABELS[category] ?? category}
          </Badge>
        </span>
        {isAdmin && json !== "{}" && json !== "null" ? (
          <CollapsibleTrigger
            className="text-xs text-primary underline-offset-2 hover:underline"
            aria-expanded={open}
            onClick={(e) => e.stopPropagation()}
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
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseBuildingAutoDeconstructedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="building.auto_deconstructed"
        isAdmin={isAdmin}
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
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseBuildingSuspendedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="building.suspended"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return (
    <span className="text-sm">
      Building suspended after <strong>{p.missedUpkeepCount}</strong> missed
      upkeeps
    </span>
  );
}

function ConstructionCompletedRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseConstructionCompletedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="construction.completed"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return (
    <span className="text-sm">
      Construction completed with <strong>{p.workers}</strong> workers
    </span>
  );
}

function ConstructionPausedRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseConstructionPausedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="construction.paused"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return (
    <span className="text-sm">
      Construction paused (<strong>{p.workers}</strong> workers assigned)
    </span>
  );
}

function DepositDepletedRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseDepositDepletedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="deposit.depleted"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return (
    <span className="text-sm">
      Deposit <strong>{p.depositName}</strong> depleted
    </span>
  );
}

function ManagedPopulationDecliningRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseManagedPopulationDecliningPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="managed_population.declining"
        isAdmin={isAdmin}
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
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseManagedPopulationExtinctPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="managed_population.extinct"
        isAdmin={isAdmin}
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
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parsePartnershipFormedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="partnership.formed"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return (
    <span className="text-sm font-mono text-xs">
      Partnership formed: {p.citizenAId.slice(0, 8)}… &amp;{" "}
      {p.citizenBId.slice(0, 8)}…
    </span>
  );
}

function PartnershipWidowedRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parsePartnershipWidowedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="partnership.widowed"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
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
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseSettlementStarvationOccurredPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="settlement.starvation_occurred"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return <span className="text-sm">Starvation deaths occurred this turn</span>;
}

function SettlementHomelessnessOccurredRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseSettlementHomelessnessOccurredPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="settlement.homelessness_occurred"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return (
    <span className="text-sm">Homelessness deaths occurred this turn</span>
  );
}

function TradeRoutePausedRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseTradeRoutePausedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="trade_route.paused"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
  return (
    <span className="text-sm">
      Trade route paused — <em>{p.pauseReason}</em> ({p.quantityPerTransition}{" "}
      units/turn)
    </span>
  );
}

function TradeRouteResumedRenderer({
  isAdmin,
  payload,
}: {
  readonly isAdmin: boolean;
  readonly payload: unknown;
}): JSX.Element {
  const p = parseTradeRouteResumedPayload(payload);
  if (p === null)
    return (
      <RawJsonFallback
        category="trade_route.resumed"
        isAdmin={isAdmin}
        payload={payload}
      />
    );
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
  readonly payload: unknown;
};

export function TurnLogPayloadRenderer({
  isAdmin = false,
  logCategory,
  payload,
}: TurnLogPayloadRendererProps): JSX.Element {
  switch (logCategory) {
    case "building.auto_deconstructed":
      return (
        <BuildingAutoDeconstructedRenderer
          isAdmin={isAdmin}
          payload={payload}
        />
      );
    case "building.suspended":
      return <BuildingSuspendedRenderer isAdmin={isAdmin} payload={payload} />;
    case "construction.completed":
      return (
        <ConstructionCompletedRenderer isAdmin={isAdmin} payload={payload} />
      );
    case "construction.paused":
      return <ConstructionPausedRenderer isAdmin={isAdmin} payload={payload} />;
    case "deposit.depleted":
      return <DepositDepletedRenderer isAdmin={isAdmin} payload={payload} />;
    case "managed_population.declining":
      return (
        <ManagedPopulationDecliningRenderer
          isAdmin={isAdmin}
          payload={payload}
        />
      );
    case "managed_population.extinct":
      return (
        <ManagedPopulationExtinctRenderer isAdmin={isAdmin} payload={payload} />
      );
    case "partnership.formed":
      return <PartnershipFormedRenderer isAdmin={isAdmin} payload={payload} />;
    case "partnership.widowed":
      return <PartnershipWidowedRenderer isAdmin={isAdmin} payload={payload} />;
    case "settlement.starvation_occurred":
      return (
        <SettlementStarvationOccurredRenderer
          isAdmin={isAdmin}
          payload={payload}
        />
      );
    case "settlement.homelessness_occurred":
      return (
        <SettlementHomelessnessOccurredRenderer
          isAdmin={isAdmin}
          payload={payload}
        />
      );
    case "trade_route.paused":
      return <TradeRoutePausedRenderer isAdmin={isAdmin} payload={payload} />;
    case "trade_route.resumed":
      return <TradeRouteResumedRenderer isAdmin={isAdmin} payload={payload} />;
    default:
      return (
        <RawJsonFallback
          category={logCategory}
          isAdmin={isAdmin}
          payload={payload}
        />
      );
  }
}
