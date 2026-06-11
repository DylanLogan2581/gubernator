import { z } from "zod";

export const cancelConstructionProjectInputSchema = z.strictObject({
  projectId: z.guid("Select a project."),
});

export type CancelConstructionProjectInput = z.input<
  typeof cancelConstructionProjectInputSchema
>;
export type CancelConstructionProjectValues = z.output<
  typeof cancelConstructionProjectInputSchema
>;
