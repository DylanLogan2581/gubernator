import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { nationsListQueryOptions } from "@/features/nations";

import { ScopeGroupSwitcher } from "./ScopeGroupSwitcher";

import type { JSX } from "react";

// Mirrors the nation detail child routes (see also AppSidebar's
// nationSectionItem) — one value per sidebar NATION item.
export type NationSection =
  | "government"
  | "overview"
  | "relationships"
  | "reports"
  | "settings"
  | "settlements";

export type NationScopeSwitcherProps = {
  readonly nationId: string | null;
  readonly section: NationSection | null;
  readonly worldId: string;
};

type NationSectionRouteId =
  | "/worlds/$worldId/nations/$nationId"
  | "/worlds/$worldId/nations/$nationId/government"
  | "/worlds/$worldId/nations/$nationId/relationships"
  | "/worlds/$worldId/nations/$nationId/reports"
  | "/worlds/$worldId/nations/$nationId/settings"
  | "/worlds/$worldId/nations/$nationId/settlements";

function sectionRouteId(section: NationSection | null): NationSectionRouteId {
  switch (section) {
    case "government":
      return "/worlds/$worldId/nations/$nationId/government";
    case "relationships":
      return "/worlds/$worldId/nations/$nationId/relationships";
    case "reports":
      return "/worlds/$worldId/nations/$nationId/reports";
    case "settings":
      return "/worlds/$worldId/nations/$nationId/settings";
    case "settlements":
      return "/worlds/$worldId/nations/$nationId/settlements";
    case "overview":
    case null:
      return "/worlds/$worldId/nations/$nationId";
  }
}

// Group-label switcher for the NATION sidebar group. Selecting a nation
// navigates to its equivalent child route (same section) when the viewer is
// currently on one, else the nation's overview — mirrors
// SettlementScopeSwitcher. A destination nation without visibility into a
// gated section (government/settings) simply gets redirected back to its
// overview by that route's own gate, same as a direct link would.
export function NationScopeSwitcher({
  nationId,
  section,
  worldId,
}: NationScopeSwitcherProps): JSX.Element {
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const nations = nationsQuery.data ?? [];
  const current =
    nationId === null
      ? null
      : (nations.find((nation) => nation.id === nationId) ?? null);
  const targetRouteId = sectionRouteId(section);

  return (
    <ScopeGroupSwitcher
      emptyLabel="No nations yet"
      errorLabel="Nations could not be loaded"
      isError={nationsQuery.isError}
      isPending={nationsQuery.isPending}
      items={nations.map((nation) => ({
        key: nation.id,
        link: (
          <Link to={targetRouteId} params={{ nationId: nation.id, worldId }}>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate text-sm font-medium">
                {nation.name}
              </span>
            </span>
            {nation.id === nationId ? (
              <Check
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-label="Current"
              />
            ) : null}
          </Link>
        ),
      }))}
      menuLabel="Nations"
      title={<>NATION{current !== null ? ` · ${current.name}` : ""}</>}
    />
  );
}
