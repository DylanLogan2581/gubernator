import { z } from "zod";

const baseFields = {
  citizenIds: z.array(z.guid("Citizen id must be a valid UUID.")),
  settlementId: z.guid("Settlement id must be a valid UUID."),
  targetId: z.guid("Target id must be a valid UUID."),
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

export const setPerTargetAssignmentInputSchema = z.discriminatedUnion(
  "assignmentType",
  [depositSchema, husbandrySchema, cullingSchema, tradeRouteSchema],
);

export type SetPerTargetAssignmentInput = z.input<
  typeof setPerTargetAssignmentInputSchema
>;
export type SetPerTargetAssignmentValues = z.output<
  typeof setPerTargetAssignmentInputSchema
>;
