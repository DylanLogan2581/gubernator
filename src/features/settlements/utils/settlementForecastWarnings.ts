import type { SettlementForecastData } from "../schemas/forecastSchemas";

export type SettlementForecastWarning = {
  readonly key: string;
  readonly label: string;
};

/**
 * Derives human-readable warnings (deaths, upkeep failures, paused trade
 * routes) from a settlement's forecast for the current turn. Shared by the
 * forecast detail panel and the settlement overview warnings card so both
 * surfaces agree on what counts as a warning.
 */
export function deriveSettlementForecastWarnings(
  forecast: SettlementForecastData,
): ReadonlyArray<SettlementForecastWarning> {
  const warnings: Array<SettlementForecastWarning> = [];

  if (forecast.deathsBy.starvation > 0) {
    warnings.push({
      key: "deaths-starvation",
      label: `${forecast.deathsBy.starvation} citizen${
        forecast.deathsBy.starvation === 1 ? "" : "s"
      } will starve this turn`,
    });
  }
  if (forecast.deathsBy.homelessness > 0) {
    warnings.push({
      key: "deaths-homelessness",
      label: `${forecast.deathsBy.homelessness} citizen${
        forecast.deathsBy.homelessness === 1 ? "" : "s"
      } will die from homelessness this turn`,
    });
  }
  if (forecast.deathsBy.other > 0) {
    warnings.push({
      key: "deaths-other",
      label: `${forecast.deathsBy.other} citizen death${
        forecast.deathsBy.other === 1 ? "" : "s"
      } expected this turn`,
    });
  }
  for (const buildingId of forecast.buildingUpkeepFailures) {
    warnings.push({
      key: `upkeep-${buildingId}`,
      label: `Building upkeep failed: ${buildingId}`,
    });
  }
  for (const trade of forecast.tradeChanges) {
    if (!trade.delivered) {
      const reason =
        trade.pauseReason !== null ? ` — ${trade.pauseReason}` : "";
      warnings.push({
        key: `trade-${trade.tradeRouteId}`,
        label: `Trade route paused${reason}`,
      });
    }
  }

  return warnings;
}
