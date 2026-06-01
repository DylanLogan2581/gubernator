import { z } from "zod";

export const setBulkConstructionAssignmentInputSchema = z.strictObject({
  constructionProjectId: z.guid(
    "Construction project id must be a valid UUID.",
  ),
  removalStrategy: z.enum(["npc_first", "random"], {
    error: "Removal strategy must be npc_first or random.",
  }),
  targetCount: z
    .number()
    .int("Target count must be an integer.")
    .min(0, "Target count must not be negative."),
});

export type SetBulkConstructionAssignmentInput = z.input<
  typeof setBulkConstructionAssignmentInputSchema
>;
export type SetBulkConstructionAssignmentValues = z.output<
  typeof setBulkConstructionAssignmentInputSchema
>;
