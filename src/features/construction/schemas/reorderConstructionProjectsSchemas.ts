import { z } from "zod";

const positionEntrySchema = z.strictObject({
  position: z.int().min(1, "Position must be a positive integer."),
  projectId: z.guid("Project id must be a valid UUID."),
});

export const reorderConstructionProjectsInputSchema = z.strictObject({
  positions: z.array(positionEntrySchema),
  settlementId: z.guid("Settlement id must be a valid UUID."),
});

export type ReorderConstructionProjectsInput = z.input<
  typeof reorderConstructionProjectsInputSchema
>;
export type ReorderConstructionProjectsValues = z.output<
  typeof reorderConstructionProjectsInputSchema
>;
export type PositionEntry = z.output<typeof positionEntrySchema>;
