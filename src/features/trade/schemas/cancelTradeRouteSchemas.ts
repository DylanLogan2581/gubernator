import { z } from "zod";

export const cancelTradeRouteInputSchema = z.strictObject({
  tradeRouteId: z.guid("Select a trade route."),
});

export type CancelTradeRouteInput = z.input<typeof cancelTradeRouteInputSchema>;
export type CancelTradeRouteValues = z.output<
  typeof cancelTradeRouteInputSchema
>;
