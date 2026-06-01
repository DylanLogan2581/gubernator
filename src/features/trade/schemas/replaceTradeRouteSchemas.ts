import { z } from "zod";

const newRoutePayloadSchema = z
  .strictObject({
    destinationSettlementId: z.guid(
      "Destination settlement id must be a valid UUID.",
    ),
    originSettlementId: z.guid("Origin settlement id must be a valid UUID."),
    quantityPerTransition: z
      .number()
      .positive("Quantity per transition must be greater than zero."),
    resourceId: z.guid("Resource id must be a valid UUID."),
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
