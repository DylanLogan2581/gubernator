import { z } from "zod";

export const manualDeconstructBuildingInputSchema = z.strictObject({
  settlementBuildingId: z.guid("Settlement building id must be a valid UUID."),
});

export type ManualDeconstructBuildingInput = z.input<
  typeof manualDeconstructBuildingInputSchema
>;
export type ManualDeconstructBuildingValues = z.output<
  typeof manualDeconstructBuildingInputSchema
>;
