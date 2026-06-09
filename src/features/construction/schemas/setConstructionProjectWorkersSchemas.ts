import { z } from "zod";

export const setConstructionProjectWorkersInputSchema = z.strictObject({
  projectId: z.guid("Project id must be a valid UUID."),
  settlementId: z.guid("Settlement id must be a valid UUID."),
  targetCount: z
    .number()
    .int("Target count must be an integer.")
    .min(0, "Target count must not be negative."),
});

export type SetConstructionProjectWorkersInput = z.input<
  typeof setConstructionProjectWorkersInputSchema
>;
export type SetConstructionProjectWorkersValues = z.output<
  typeof setConstructionProjectWorkersInputSchema
>;
