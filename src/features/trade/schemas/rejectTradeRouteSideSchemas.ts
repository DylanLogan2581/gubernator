import { z } from "zod";

export const rejectTradeRouteSideInputSchema = z.strictObject({
  rejectorCitizenId: z.guid("Select a rejector."),
  side: z.enum(["origin", "destination"], {
    message: 'Side must be "origin" or "destination".',
  }),
  tradeRouteId: z.guid("Select a trade route."),
});

export type RejectTradeRouteSideInput = z.input<
  typeof rejectTradeRouteSideInputSchema
>;
export type RejectTradeRouteSideValues = z.output<
  typeof rejectTradeRouteSideInputSchema
>;
