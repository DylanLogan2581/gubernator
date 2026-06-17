import { z } from "zod";

// Zod schema mirroring the engine's SettlementForecast type.
// Use z.object() (not strict) so additive engine changes don't break validation.
const settlementForecastDataSchema = z.object({
  settlementId: z.string(),
  resourceDeltas: z.array(
    z.object({
      resourceId: z.string(),
      produced: z.number(),
      consumed: z.number(),
      tradeIn: z.number(),
      tradeOut: z.number(),
      netDelta: z.number(),
      quantityBefore: z.number(),
      quantityAfter: z.number(),
    }),
  ),
  deathsBy: z.object({
    starvation: z.number(),
    homelessness: z.number(),
    other: z.number(),
  }),
  completedProjects: z.array(z.string()),
  buildingUpkeepFailures: z.array(z.string()),
  tradeChanges: z.array(
    z.object({
      tradeRouteId: z.string(),
      delivered: z.boolean(),
      pauseReason: z.string().nullable(),
      quantityTransferred: z.number(),
    }),
  ),
});

// Zod schema mirroring the engine's ForecastSnapshot type.
export const forecastSnapshotSchema = z.object({
  bySettlement: z.record(z.string(), settlementForecastDataSchema),
});

export type ForecastSnapshot = z.infer<typeof forecastSnapshotSchema>;
export type SettlementForecastData = z.infer<
  typeof settlementForecastDataSchema
>;
