import { z } from "zod";

export const setBulkConstructionPoolInputSchema = z.strictObject({
  settlementId: z.guid("Select a settlement."),
  targetCount: z
    .number()
    .int("Target count must be an integer.")
    .min(0, "Target count must not be negative."),
});

export type SetBulkConstructionPoolInput = z.input<
  typeof setBulkConstructionPoolInputSchema
>;
export type SetBulkConstructionPoolValues = z.output<
  typeof setBulkConstructionPoolInputSchema
>;
