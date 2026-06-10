import { z } from "zod";

const baseFields = {
  settlementId: z.guid("Select a settlement."),
  targetCount: z
    .number()
    .int("Target count must be an integer.")
    .min(0, "Target count must not be negative."),
  targetId: z.guid("Select a target."),
};

const depositSchema = z.strictObject({
  ...baseFields,
  assignmentType: z.literal("deposit"),
});

const husbandrySchema = z.strictObject({
  ...baseFields,
  assignmentType: z.literal("husbandry"),
});

const cullingSchema = z.strictObject({
  ...baseFields,
  assignmentType: z.literal("culling"),
});

const tradeRouteSchema = z.strictObject({
  ...baseFields,
  assignmentType: z.literal("trade_route"),
  tradeRouteEnd: z.enum(["origin", "destination"], {
    error: "Trade route end must be origin or destination.",
  }),
});

export const setPerTargetBulkAssignmentInputSchema = z.discriminatedUnion(
  "assignmentType",
  [depositSchema, husbandrySchema, cullingSchema, tradeRouteSchema],
);

export type SetPerTargetBulkAssignmentInput = z.input<
  typeof setPerTargetBulkAssignmentInputSchema
>;
export type SetPerTargetBulkAssignmentValues = z.output<
  typeof setPerTargetBulkAssignmentInputSchema
>;
