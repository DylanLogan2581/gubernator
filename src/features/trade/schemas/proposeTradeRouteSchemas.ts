import { z } from "zod";

export const proposeTradeRouteInputSchema = z
  .strictObject({
    destinationSettlementId: z.guid(
      "Destination settlement id must be a valid UUID.",
    ),
    originSettlementId: z.guid("Origin settlement id must be a valid UUID."),
    proposingCitizenId: z.guid("Proposing citizen id must be a valid UUID."),
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

export type ProposeTradeRouteInput = z.input<
  typeof proposeTradeRouteInputSchema
>;
export type ProposeTradeRouteValues = z.output<
  typeof proposeTradeRouteInputSchema
>;
