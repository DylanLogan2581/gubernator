import { z } from "zod";

const depositInstanceIdSchema = z.guid(
  "Deposit instance id must be a valid UUID.",
);

export const restoreDepositInstanceInputSchema = z.strictObject({
  depositInstanceId: depositInstanceIdSchema,
});

export type RestoreDepositInstanceInput = z.input<
  typeof restoreDepositInstanceInputSchema
>;
export type RestoreDepositInstanceValues = z.output<
  typeof restoreDepositInstanceInputSchema
>;
