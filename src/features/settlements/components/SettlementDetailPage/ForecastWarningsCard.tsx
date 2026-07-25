import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { getErrorDescription } from "@/lib/errorUtils";

import { settlementForecastQueryOptions } from "../../queries/settlementForecastQueries";
import { deriveSettlementForecastWarnings } from "../../utils/settlementForecastWarnings";

import type { JSX } from "react";

/**
 * Reclaims the settlement overview grid cell previously held by the
 * standalone readiness card, surfacing the critical warnings the forecast
 * already computes (starvation/homelessness deaths, upkeep failures, paused
 * trade routes) so the cell stays informative rather than empty.
 */
export function SettlementForecastWarningsCard({
  settlementId,
  worldId,
}: {
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const forecastQuery = useQuery(settlementForecastQueryOptions(worldId));

  if (forecastQuery.isPending) {
    return <LoadingState label="Loading forecast warnings…" />;
  }

  if (forecastQuery.isError) {
    return (
      <ErrorState
        title="Forecast warnings could not be loaded"
        description={getErrorDescription(forecastQuery.error)}
      />
    );
  }

  const forecast =
    forecastQuery.data?.forecastSnapshot.bySettlement[settlementId] ?? null;
  const warnings =
    forecast === null ? [] : deriveSettlementForecastWarnings(forecast);

  return (
    <section
      aria-labelledby="forecast-warnings-heading"
      className="grid gap-3 p-4"
    >
      <h2 id="forecast-warnings-heading" className="text-base font-medium">
        Forecast Warnings
      </h2>
      {warnings.length === 0 ? (
        <EmptyState
          title="No forecast warnings"
          description="Nothing critical expected for this settlement next turn."
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {warnings.map((warning) => (
            <li
              key={warning.key}
              className="flex items-center gap-2 py-2 text-sm"
            >
              <AlertTriangle
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-destructive"
              />
              {warning.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
