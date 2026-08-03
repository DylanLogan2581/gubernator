import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type JSX } from "react";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { TradeRouteRow } from "./TradeRouteRow";

import type { TradeRoute } from "../../types/tradeRouteTypes";
import type { QueryClient } from "@tanstack/react-query";

export function TradeRoutesDirection({
  activeCharacterId,
  canManageRoutes,
  label,
  queryClient,
  resumedRouteIds,
  routes,
  selectedRouteId,
  settlementId,
  side,
  traderCountByRoute,
  worldId,
  onSelectRoute,
}: {
  readonly activeCharacterId: string | null;
  readonly canManageRoutes: boolean;
  readonly label: string;
  readonly queryClient: QueryClient;
  readonly resumedRouteIds: ReadonlySet<string>;
  readonly routes: readonly TradeRoute[];
  readonly selectedRouteId: string | null;
  readonly settlementId: string;
  readonly side: "destination" | "origin";
  readonly traderCountByRoute: ReadonlyMap<string, number>;
  readonly worldId: string;
  readonly onSelectRoute: (routeId: string) => void;
}): JSX.Element | null {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (routes.length === 0) return null;

  const panelId = `trade-routes-${label.toLowerCase()}`;

  return (
    <div className="grid gap-1">
      <button
        aria-controls={panelId}
        aria-expanded={!isCollapsed}
        className="flex cursor-pointer items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        onClick={() => {
          setIsCollapsed((prev) => !prev);
        }}
      >
        {isCollapsed ? (
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        )}
        {label} ({routes.length})
      </button>
      {!isCollapsed ? (
        <div className="overflow-x-auto rounded-md border" id={panelId}>
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="text-muted-foreground">
                <TableHead scope="col">
                  {side === "origin" ? "Destination" : "Origin"}
                </TableHead>
                <TableHead scope="col">Resources</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Approval</TableHead>
                {canManageRoutes ? (
                  <TableHead
                    scope="col"
                    className="w-48"
                    aria-label="Actions"
                  />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => (
                <TradeRouteRow
                  key={route.id}
                  activeCharacterId={activeCharacterId}
                  canManageRoutes={canManageRoutes}
                  isResumedThisTransition={resumedRouteIds.has(route.id)}
                  isSelected={route.id === selectedRouteId}
                  queryClient={queryClient}
                  route={route}
                  settlementId={settlementId}
                  side={side}
                  traderCount={traderCountByRoute.get(route.id) ?? 0}
                  worldId={worldId}
                  onSelect={() => {
                    onSelectRoute(route.id);
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
