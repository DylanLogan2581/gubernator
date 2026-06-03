import { z } from "zod";

export const approveTradeRouteSideInputSchema = z.strictObject({
  approverCitizenId: z.guid("Approver citizen id must be a valid UUID."),
  side: z.enum(["origin", "destination"], {
    message: 'Side must be "origin" or "destination".',
  }),
  tradeRouteId: z.guid("Trade route id must be a valid UUID."),
});

export type ApproveTradeRouteSideInput = z.input<
  typeof approveTradeRouteSideInputSchema
>;
export type ApproveTradeRouteSideValues = z.output<
  typeof approveTradeRouteSideInputSchema
>;
