import { z } from "zod";

export const setBulkConstructionAssignmentInputSchema = z.strictObject({
  constructionProjectId: z.guid(
    "Construction project id must be a valid UUID.",
  ),
  settlementId: z.guid("Settlement id must be a valid UUID."),
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
