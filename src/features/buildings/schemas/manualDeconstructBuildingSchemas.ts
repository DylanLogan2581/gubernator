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

export const restoreSettlementBuildingInputSchema = z.strictObject({
  settlementBuildingId: z.guid("Settlement building id must be a valid UUID."),
  worldId: z.guid("World id must be a valid UUID."),
});

export type RestoreSettlementBuildingInput = z.input<
  typeof restoreSettlementBuildingInputSchema
>;
export type RestoreSettlementBuildingValues = z.output<
  typeof restoreSettlementBuildingInputSchema
>;

export const hardDeleteSettlementBuildingInputSchema = z.strictObject({
  settlementBuildingId: z.guid("Settlement building id must be a valid UUID."),
  worldId: z.guid("World id must be a valid UUID."),
});

export type HardDeleteSettlementBuildingInput = z.input<
  typeof hardDeleteSettlementBuildingInputSchema
>;
export type HardDeleteSettlementBuildingValues = z.output<
  typeof hardDeleteSettlementBuildingInputSchema
>;
