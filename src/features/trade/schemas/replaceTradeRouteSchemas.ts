import { z } from "zod";

import { tradeRouteLegInputSchema } from "./proposeTradeRouteSchemas";

const newRoutePayloadSchema = z
  .strictObject({
    destinationSettlementId: z.guid(
      "Destination settlement id must be a valid UUID.",
    ),
    legs: z
      .array(tradeRouteLegInputSchema)
      .min(1, "Trade route must have at least one leg."),
    originSettlementId: z.guid("Origin settlement id must be a valid UUID."),
  })
  .superRefine((value, ctx): void => {
    if (value.originSettlementId === value.destinationSettlementId) {
      ctx.addIssue({
        code: "custom",
        message: "Origin and destination settlements must be different.",
        path: ["destinationSettlementId"],
      });
    }
  });

export const replaceTradeRouteInputSchema = z.strictObject({
  newRoutePayload: newRoutePayloadSchema,
  oldRouteId: z.guid("Old route id must be a valid UUID."),
  proposingCitizenId: z.guid("Proposing citizen id must be a valid UUID."),
});

export type ReplaceTradeRouteInput = z.input<
  typeof replaceTradeRouteInputSchema
>;
export type ReplaceTradeRouteValues = z.output<
  typeof replaceTradeRouteInputSchema
>;
