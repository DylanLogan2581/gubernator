import { z } from "zod";

export const createConstructionProjectInputSchema = z.strictObject({
  blueprintId: z.guid("Blueprint id must be a valid UUID."),
  settlementId: z.guid("Settlement id must be a valid UUID."),
  targetTierId: z.guid("Target tier id must be a valid UUID."),
});

export type CreateConstructionProjectInput = z.input<
  typeof createConstructionProjectInputSchema
>;
export type CreateConstructionProjectValues = z.output<
  typeof createConstructionProjectInputSchema
>;
