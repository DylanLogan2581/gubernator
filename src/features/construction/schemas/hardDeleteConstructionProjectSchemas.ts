import { z } from "zod";

export const hardDeleteConstructionProjectInputSchema = z.strictObject({
  projectId: z.guid("Project id must be a valid UUID."),
});

export type HardDeleteConstructionProjectInput = z.input<
  typeof hardDeleteConstructionProjectInputSchema
>;
export type HardDeleteConstructionProjectValues = z.output<
  typeof hardDeleteConstructionProjectInputSchema
>;
