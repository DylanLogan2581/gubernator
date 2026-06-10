import { z } from "zod";

export const hardDeleteConstructionProjectInputSchema = z.strictObject({
  projectId: z.guid("Select a project."),
});

export type HardDeleteConstructionProjectInput = z.input<
  typeof hardDeleteConstructionProjectInputSchema
>;
export type HardDeleteConstructionProjectValues = z.output<
  typeof hardDeleteConstructionProjectInputSchema
>;
