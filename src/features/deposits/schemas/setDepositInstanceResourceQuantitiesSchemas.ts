import { z } from "zod";

const depositInstanceResourceIdSchema = z.guid(
  "Deposit instance resource id must be a valid UUID.",
);
const settlementIdSchema = z.guid("Select a settlement.");

export const setDepositInstanceResourceQuantitiesInputSchema = z.strictObject({
  depositInstanceResourceId: depositInstanceResourceIdSchema,
  initialQuantity: z
    .number()
    .min(0, "Initial quantity must be >= 0.")
    .finite("Initial quantity must be finite."),
  remainingQuantity: z
    .number()
    .min(0, "Remaining quantity must be >= 0.")
    .finite("Remaining quantity must be finite."),
  settlementId: settlementIdSchema,
});

export type SetDepositInstanceResourceQuantitiesInput = z.input<
  typeof setDepositInstanceResourceQuantitiesInputSchema
>;
export type SetDepositInstanceResourceQuantitiesValues = z.output<
  typeof setDepositInstanceResourceQuantitiesInputSchema
>;
