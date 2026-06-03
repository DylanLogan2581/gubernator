import { z } from "zod";

export const cancelTradeRouteInputSchema = z.strictObject({
  tradeRouteId: z.guid("Trade route id must be a valid UUID."),
});

export type CancelTradeRouteInput = z.input<typeof cancelTradeRouteInputSchema>;
export type CancelTradeRouteValues = z.output<
  typeof cancelTradeRouteInputSchema
>;
