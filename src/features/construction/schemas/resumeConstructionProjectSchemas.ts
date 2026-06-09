import { z } from "zod";

export const resumeConstructionProjectInputSchema = z.strictObject({
  projectId: z.guid("Project id must be a valid UUID."),
});

export type ResumeConstructionProjectInput = z.input<
  typeof resumeConstructionProjectInputSchema
>;
export type ResumeConstructionProjectValues = z.output<
  typeof resumeConstructionProjectInputSchema
>;
