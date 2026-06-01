import { z } from "zod";

const settlementIdSchema = z.guid("Settlement id must be a valid UUID.");
const resourceIdSchema = z.guid("Resource id must be a valid UUID.");

const quantitySchema = z
  .string()
  .regex(
    /^\d+(\.\d{1,4})?$/,
    "Quantity must be a non-negative decimal with up to four decimal places.",
  )
  .transform((value): number => parseFloat(value));

export const updateSettlementStockpileInputSchema = z.strictObject({
  quantity: quantitySchema,
  resourceId: resourceIdSchema,
  settlementId: settlementIdSchema,
});

export type UpdateSettlementStockpileInput = z.input<
  typeof updateSettlementStockpileInputSchema
>;
export type UpdateSettlementStockpileValues = z.output<
  typeof updateSettlementStockpileInputSchema
>;
