export const settlementForecastQueryKeys = {
  all: ["forecast"] as const,
  byWorld: (worldId: string) =>
    [...settlementForecastQueryKeys.all, "world", worldId] as const,
} as const;
