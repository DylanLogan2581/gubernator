import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { nationsListQueryOptions } from "@/features/nations";

import { ScopeGroupSwitcher } from "./ScopeGroupSwitcher";

import type { JSX } from "react";

export type NationScopeSwitcherProps = {
  readonly nationId: string | null;
  readonly worldId: string;
};

// Group-label switcher for the NATION sidebar group. `nationsListQueryOptions`
// already excludes hidden nations for non-admins via RLS
// (nations_select_world_access, 20260522000001_extend_rls_permission_helpers.sql),
// so no client-side filtering is needed here. Nation sub-pages aren't split
// into child routes yet (only Overview exists — see AppSidebar's
// nationItems), so switching nation always lands on the destination
// nation's overview.
export function NationScopeSwitcher({
  nationId,
  worldId,
}: NationScopeSwitcherProps): JSX.Element {
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const nations = nationsQuery.data ?? [];
  const current =
    nationId === null
      ? null
      : (nations.find((nation) => nation.id === nationId) ?? null);

  return (
    <ScopeGroupSwitcher
      emptyLabel="No nations yet"
      errorLabel="Nations could not be loaded"
      isError={nationsQuery.isError}
      isPending={nationsQuery.isPending}
      items={nations.map((nation) => ({
        key: nation.id,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId"
            params={{ nationId: nation.id, worldId }}
          >
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
