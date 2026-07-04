import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { settlementsByWorldQueryOptions } from "@/features/settlements";

import { ScopeGroupSwitcher } from "./ScopeGroupSwitcher";

import type { JSX } from "react";

// Mirrors SettlementDetailPage's SECTION_TABS (see also AppSidebar's
// settlementSectionItem) — the settlement detail route isn't split into
// child routes yet, so switching settlement keeps the current `?section=`
// tab on the destination settlement when one is active.
export type SettlementSection =
  | "admin"
  | "economy"
  | "forecast"
  | "history"
  | "overview"
  | "population"
  | "reports";

export type SettlementScopeSwitcherProps = {
  readonly section: SettlementSection | null;
  readonly settlementId: string | null;
  readonly worldId: string;
};

// Group-label switcher for the SETTLEMENT sidebar group. Selecting a
// settlement navigates to its equivalent sub-page (same `?section=`) when
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
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
            params={{
              nationId: settlement.nationId,
              settlementId: settlement.id,
              worldId,
            }}
            search={section === null ? { section: "overview" } : { section }}
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
