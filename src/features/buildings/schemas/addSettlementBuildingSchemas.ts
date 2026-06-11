import { z } from "zod";

export const addSettlementBuildingInputSchema = z.strictObject({
  blueprintId: z.guid("Select a blueprint."),
  name: z.string().trim().max(200).optional(),
  settlementId: z.guid("Select a settlement."),
  tierId: z.guid("Select a tier."),
});

export type AddSettlementBuildingInput = z.input<
  typeof addSettlementBuildingInputSchema
>;
export type AddSettlementBuildingValues = z.output<
  typeof addSettlementBuildingInputSchema
>;
