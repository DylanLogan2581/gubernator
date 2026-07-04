import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { settlementsByWorldQueryOptions } from "@/features/settlements";

import { ScopeGroupSwitcher } from "./ScopeGroupSwitcher";

import type { JSX } from "react";

// Mirrors the settlement detail child routes (see also AppSidebar's
// settlementSectionItem) — one value per sidebar SETTLEMENT item.
export type SettlementSection =
  | "buildings"
  | "citizens"
  | "construction"
  | "deposits"
  | "forecast"
  | "history"
  | "overview"
  | "populations"
  | "reports"
  | "settings"
  | "stockpiles"
  | "trade";

export type SettlementScopeSwitcherProps = {
  readonly section: SettlementSection | null;
  readonly settlementId: string | null;
  readonly worldId: string;
};

type SettlementSectionRouteId =
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/citizens"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/construction"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/deposits"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/history"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/populations"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/reports"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/settings"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/stockpiles"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/trade";

function sectionRouteId(
  section: SettlementSection | null,
): SettlementSectionRouteId {
  switch (section) {
    case "buildings":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings";
    case "citizens":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/citizens";
    case "construction":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/construction";
    case "deposits":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/deposits";
    case "forecast":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast";
    case "history":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/history";
    case "populations":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/populations";
    case "reports":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/reports";
    case "settings":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/settings";
    case "stockpiles":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/stockpiles";
    case "trade":
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId/trade";
    case "overview":
    case null:
      return "/worlds/$worldId/nations/$nationId/settlements/$settlementId";
  }
}

// Group-label switcher for the SETTLEMENT sidebar group. Selecting a
// settlement navigates to its equivalent child route (same section) when
// the viewer is currently on one, else the settlement's overview — and
// updates the pinned scope via WorldScopeProvider observing the resulting
// route params.
export function SettlementScopeSwitcher({
  section,
  settlementId,
  worldId,
}: SettlementScopeSwitcherProps): JSX.Element {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const settlements = settlementsQuery.data ?? [];
  const current =
    settlementId === null
      ? null
      : (settlements.find((settlement) => settlement.id === settlementId) ??
        null);
  const targetRouteId = sectionRouteId(section);

  return (
    <ScopeGroupSwitcher
      emptyLabel="No settlements yet"
      errorLabel="Settlements could not be loaded"
      isError={settlementsQuery.isError}
      isPending={settlementsQuery.isPending}
      items={settlements.map((settlement) => ({
        key: settlement.id,
        link: (
          <Link
            to={targetRouteId}
            params={{
              nationId: settlement.nationId,
              settlementId: settlement.id,
              worldId,
            }}
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate text-sm font-medium">
                {settlement.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {settlement.nationName}
              </span>
            </span>
            {settlement.id === settlementId ? (
              <Check
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-label="Current"
              />
            ) : null}
          </Link>
        ),
      }))}
      menuLabel="Settlements"
      title={<>SETTLEMENT{current !== null ? ` · ${current.name}` : ""}</>}
    />
  );
}
