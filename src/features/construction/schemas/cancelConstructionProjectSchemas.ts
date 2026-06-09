import { z } from "zod";

export const cancelConstructionProjectInputSchema = z.strictObject({
  projectId: z.guid("Project id must be a valid UUID."),
});

export type CancelConstructionProjectInput = z.input<
  typeof cancelConstructionProjectInputSchema
>;
export type CancelConstructionProjectValues = z.output<
  typeof cancelConstructionProjectInputSchema
>;
