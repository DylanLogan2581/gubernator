import { z } from "zod";

export const addSettlementBuildingInputSchema = z.strictObject({
  blueprintId: z.guid("Blueprint ID must be a valid UUID."),
  name: z.string().trim().max(200).optional(),
  settlementId: z.guid("Settlement ID must be a valid UUID."),
  tierId: z.guid("Tier ID must be a valid UUID."),
});

export type AddSettlementBuildingInput = z.input<
  typeof addSettlementBuildingInputSchema
>;
export type AddSettlementBuildingValues = z.output<
  typeof addSettlementBuildingInputSchema
>;
