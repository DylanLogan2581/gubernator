import { z } from "zod";

export const tradeRouteLegInputSchema = z.strictObject({
  direction: z.enum(["send", "receive"], {
    message: "Direction must be 'send' or 'receive'.",
  }),
  quantity: z
    .number()
    .positive("Quantity per transition must be greater than zero."),
  resourceId: z.guid("Select a resource."),
});

export type TradeRouteLegInput = z.input<typeof tradeRouteLegInputSchema>;
export type TradeRouteLegValues = z.output<typeof tradeRouteLegInputSchema>;

export const proposeTradeRouteInputSchema = z
  .strictObject({
    destinationSettlementId: z.guid(
      "Destination settlement id must be a valid UUID.",
    ),
    legs: z
      .array(tradeRouteLegInputSchema)
      .min(1, "Trade route must have at least one leg."),
    originSettlementId: z.guid("Select an origin settlement."),
    proposingCitizenId: z.guid("Select a proposing citizen."),
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
