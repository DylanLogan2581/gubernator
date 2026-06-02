import { z } from "zod";

export const setBulkStandardJobAssignmentInputSchema = z.strictObject({
  jobId: z.guid("Job id must be a valid UUID."),
  settlementId: z.guid("Settlement id must be a valid UUID."),
  targetCount: z
    .number()
    .int("Target count must be an integer.")
    .min(0, "Target count must not be negative."),
});

export type SetBulkStandardJobAssignmentInput = z.input<
  typeof setBulkStandardJobAssignmentInputSchema
>;
export type SetBulkStandardJobAssignmentValues = z.output<
  typeof setBulkStandardJobAssignmentInputSchema
>;
