import { z } from "zod";

export const setConstructionProjectWorkersInputSchema = z.strictObject({
  projectId: z.guid("Select a project."),
  settlementId: z.guid("Select a settlement."),
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
