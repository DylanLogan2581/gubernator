import { z } from "zod";

const depositInstanceIdSchema = z.guid(
  "Deposit instance id must be a valid UUID.",
);

export const removeDepositInstanceInputSchema = z.strictObject({
  depositInstanceId: depositInstanceIdSchema,
});

export type RemoveDepositInstanceInput = z.input<
  typeof removeDepositInstanceInputSchema
>;
export type RemoveDepositInstanceValues = z.output<
  typeof removeDepositInstanceInputSchema
>;
