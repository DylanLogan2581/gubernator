import { z } from "zod";

export const resumeConstructionProjectInputSchema = z.strictObject({
  projectId: z.guid("Select a project."),
});

export type ResumeConstructionProjectInput = z.input<
  typeof resumeConstructionProjectInputSchema
>;
export type ResumeConstructionProjectValues = z.output<
  typeof resumeConstructionProjectInputSchema
>;
