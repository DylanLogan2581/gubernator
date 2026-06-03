import { z } from "zod";

export const rejectTradeRouteSideInputSchema = z.strictObject({
  rejectorCitizenId: z.guid("Rejector citizen id must be a valid UUID."),
  side: z.enum(["origin", "destination"], {
    message: 'Side must be "origin" or "destination".',
  }),
  tradeRouteId: z.guid("Trade route id must be a valid UUID."),
});

export type RejectTradeRouteSideInput = z.input<
  typeof rejectTradeRouteSideInputSchema
>;
export type RejectTradeRouteSideValues = z.output<
  typeof rejectTradeRouteSideInputSchema
>;
