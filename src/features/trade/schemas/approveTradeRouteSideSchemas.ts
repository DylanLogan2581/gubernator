import { z } from "zod";

export const approveTradeRouteSideInputSchema = z.strictObject({
  approverCitizenId: z.guid("Select an approver."),
  side: z.enum(["origin", "destination"], {
    message: 'Side must be "origin" or "destination".',
  }),
  tradeRouteId: z.guid("Select a trade route."),
});

export type ApproveTradeRouteSideInput = z.input<
  typeof approveTradeRouteSideInputSchema
>;
export type ApproveTradeRouteSideValues = z.output<
  typeof approveTradeRouteSideInputSchema
>;
