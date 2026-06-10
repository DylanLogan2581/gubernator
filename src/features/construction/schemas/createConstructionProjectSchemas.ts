import { z } from "zod";

export const createConstructionProjectInputSchema = z.strictObject({
  blueprintId: z.guid("Select a blueprint."),
  settlementId: z.guid("Select a settlement."),
  targetTierId: z.guid("Select a target tier."),
});

export type CreateConstructionProjectInput = z.input<
  typeof createConstructionProjectInputSchema
>;
export type CreateConstructionProjectValues = z.output<
  typeof createConstructionProjectInputSchema
>;
