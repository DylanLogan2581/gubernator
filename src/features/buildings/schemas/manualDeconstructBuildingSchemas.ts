import { z } from "zod";

export const manualDeconstructBuildingInputSchema = z.strictObject({
  settlementBuildingId: z.guid("Select a settlement building."),
});

export type ManualDeconstructBuildingInput = z.input<
  typeof manualDeconstructBuildingInputSchema
>;
export type ManualDeconstructBuildingValues = z.output<
  typeof manualDeconstructBuildingInputSchema
>;

export const restoreSettlementBuildingInputSchema = z.strictObject({
  settlementBuildingId: z.guid("Select a settlement building."),
  worldId: z.guid("Select a world."),
});

export type RestoreSettlementBuildingInput = z.input<
  typeof restoreSettlementBuildingInputSchema
>;
export type RestoreSettlementBuildingValues = z.output<
  typeof restoreSettlementBuildingInputSchema
>;

export const hardDeleteSettlementBuildingInputSchema = z.strictObject({
  settlementBuildingId: z.guid("Select a settlement building."),
  worldId: z.guid("Select a world."),
});

export type HardDeleteSettlementBuildingInput = z.input<
  typeof hardDeleteSettlementBuildingInputSchema
>;
export type HardDeleteSettlementBuildingValues = z.output<
  typeof hardDeleteSettlementBuildingInputSchema
>;
