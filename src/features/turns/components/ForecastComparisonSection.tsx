import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import type {
  TurnTransitionOutcome,
  TurnTransitionResourceSnapshot,
} from "@/features/turns";

import type { JSX } from "react";

type SettlementForecast = {
  readonly settlementId: string;
  readonly resourceDeltas: ReadonlyArray<{
    readonly resourceId: string;
    readonly produced: number;
    readonly consumed: number;
    readonly tradeIn: number;
    readonly tradeOut: number;
    readonly netDelta: number;
    readonly quantityBefore: number;
    readonly quantityAfter: number;
  }>;
  readonly deathsBy: {
    readonly starvation: number;
    readonly homelessness: number;
    readonly other: number;
  };
  readonly completedProjects: readonly string[];
  readonly buildingUpkeepFailures: readonly string[];
  readonly tradeChanges: ReadonlyArray<{
    readonly tradeRouteId: string;
    readonly delivered: boolean;
    readonly pauseReason: string | null;
    readonly quantityTransferred: number;
  }>;
};

type ForecastSnapshot = {
  readonly bySettlement: {
    readonly [settlementId: string]: SettlementForecast;
  };
};

function isForecastSnapshot(val: unknown): val is ForecastSnapshot {
  return (
    typeof val === "object" &&
    val !== null &&
    "bySettlement" in val &&
    typeof (val as Record<string, unknown>).bySettlement === "object"
  );
}

function getSettlementForecast(
  forecastSnapshot: ForecastSnapshot,
  settlementIds: string[],
): SettlementForecast | null {
  // For single settlement, return its forecast if available
  if (settlementIds.length === 1) {
    const settlementId = settlementIds[0];
    const forecast = forecastSnapshot.bySettlement[settlementId];
    return forecast ?? null;
  }

  // For multiple settlements (world scope), cannot meaningfully compare
  return null;
}

function compareResourceDelta(
  forecastDelta: SettlementForecast["resourceDeltas"][0],
  actual: TurnTransitionResourceSnapshot,
): {
  readonly diverged: boolean;
  readonly forecastValue: number;
  readonly actualValue: number;
  readonly reason?: string;
} {
  const forecastNetDelta = forecastDelta.netDelta;
  const actualNetDelta = actual.quantityAfter - actual.quantityBefore;

  return {
    actualValue: actualNetDelta,
    diverged: forecastNetDelta !== actualNetDelta,
    forecastValue: forecastNetDelta,
  };
}

export function ForecastComparisonSection({
  outcome,
}: {
  readonly outcome: TurnTransitionOutcome;
}): JSX.Element | null {
  const { settlementForecast, settlementIds } = useMemo(() => {
    if (outcome.forecastSnapshot === null) {
      return { settlementForecast: null, settlementIds: [] };
    }

    if (!isForecastSnapshot(outcome.forecastSnapshot)) {
      return { settlementForecast: null, settlementIds: [] };
    }

    const ids = [
      ...new Set(outcome.settlementSnapshots.map((s) => s.settlementId)),
    ];

    const forecast = getSettlementForecast(outcome.forecastSnapshot, ids);

    return { settlementForecast: forecast, settlementIds: ids };
  }, [outcome.forecastSnapshot, outcome.settlementSnapshots]);

  const resourceComparisons = useMemo(() => {
    if (
      settlementForecast === null ||
      settlementIds.length !== 1 ||
      settlementIds[0] === undefined
    ) {
      return [];
    }

    const settlementId = settlementIds[0];
    const settlementResourceSnapshots =
      outcome.settlementResourceSnapshots.filter(
        (snap) => snap.settlementId === settlementId,
      );

    const comparisons: Array<{
      readonly resourceId: string;
      readonly forecast: SettlementForecast["resourceDeltas"][0];
      readonly actual: TurnTransitionResourceSnapshot | undefined;
      readonly comparison: ReturnType<typeof compareResourceDelta>;
    }> = [];

    for (const forecastDelta of settlementForecast.resourceDeltas) {
      const actual = settlementResourceSnapshots.find(
        (snap) => snap.resourceId === forecastDelta.resourceId,
      );

      if (actual !== undefined) {
        comparisons.push({
          actual,
          comparison: compareResourceDelta(forecastDelta, actual),
          forecast: forecastDelta,
          resourceId: forecastDelta.resourceId,
        });
      }
    }

    return comparisons;
  }, [settlementForecast, settlementIds, outcome.settlementResourceSnapshots]);

  const deathComparison = useMemo(() => {
    if (
      settlementForecast === null ||
      settlementIds.length !== 1 ||
      settlementIds[0] === undefined
    ) {
      return null;
    }

    const settlementId = settlementIds[0];
    const settlementSnapshot = outcome.settlementSnapshots.find(
      (s) => s.settlementId === settlementId,
    );

    if (settlementSnapshot === undefined) {
      return null;
    }

    const forecastTotalDeaths =
      settlementForecast.deathsBy.starvation +
      settlementForecast.deathsBy.homelessness +
      settlementForecast.deathsBy.other;
    const actualTotalDeaths = settlementSnapshot.deathCount;

    return {
      actualTotalDeaths,
      forecastTotalDeaths,
      diverged: forecastTotalDeaths !== actualTotalDeaths,
      forecastBreakdown: settlementForecast.deathsBy,
    };
  }, [settlementForecast, settlementIds, outcome.settlementSnapshots]);

  // Hide section if no forecast available
  if (
    settlementForecast === null ||
    (resourceComparisons.length === 0 && deathComparison === null)
  ) {
    return null;
  }

  const divergedResources = resourceComparisons.filter(
    (c) => c.comparison.diverged,
  );
  const matchingResources = resourceComparisons.filter(
    (c) => !c.comparison.diverged,
  );

  return (
    <section
      aria-labelledby="forecast-comparison-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="space-y-1">
        <h2
          id="forecast-comparison-title"
          className="text-lg font-semibold tracking-normal"
        >
          What Changed vs Forecast
        </h2>
        <p className="text-sm text-muted-foreground">
          Comparison of forecasted vs actual outcomes for this transition
        </p>
      </div>

      <div className="space-y-4">
        {/* Deaths comparison */}
        {deathComparison !== null && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Deaths</h3>
            {deathComparison.diverged ? (
              <div className="flex items-center gap-2">
                <Badge variant="destructive">Diverged</Badge>
                <span className="text-sm text-muted-foreground">
                  Forecast: {deathComparison.forecastTotalDeaths} | Actual:{" "}
                  {deathComparison.actualTotalDeaths}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Matched</Badge>
                <span className="text-sm text-muted-foreground">
                  {deathComparison.actualTotalDeaths} deaths (
                  {deathComparison.forecastBreakdown.starvation} starvation,{" "}
                  {deathComparison.forecastBreakdown.homelessness} homelessness,{" "}
                  {deathComparison.forecastBreakdown.other} other)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Resources section */}
        {resourceComparisons.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Resources</h3>

            {/* Diverged resources */}
            {divergedResources.length > 0 && (
              <div className="space-y-1">
                {divergedResources.map((comp) => (
                  <div
                    key={comp.resourceId}
                    className="flex items-center justify-between rounded border border-border/50 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        Diverged
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {comp.resourceId}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">
                        Forecast: {comp.comparison.forecastValue}
                      </span>
                      <span className="mx-1">→</span>
                      <span>Actual: {comp.comparison.actualValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Matching resources - compact summary */}
            {matchingResources.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {matchingResources.length} resource
                {matchingResources.length === 1 ? "" : "s"} matched forecast
              </div>
            )}
          </div>
        )}

        {/* Completed projects */}
        {settlementForecast.completedProjects.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Completions</h3>
            <p className="text-sm text-muted-foreground">
              {settlementForecast.completedProjects.length} project
              {settlementForecast.completedProjects.length === 1
                ? ""
                : "s"}{" "}
              completed
            </p>
          </div>
        )}

        {/* Building upkeep failures */}
        {settlementForecast.buildingUpkeepFailures.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Building Upkeep</h3>
            <Badge variant="secondary" className="text-xs">
              {settlementForecast.buildingUpkeepFailures.length} building
              {settlementForecast.buildingUpkeepFailures.length === 1
                ? ""
                : "s"}{" "}
              with missed upkeep
            </Badge>
          </div>
        )}
      </div>
    </section>
  );
}
