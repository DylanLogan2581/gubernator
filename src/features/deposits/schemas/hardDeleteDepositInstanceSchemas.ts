import { z } from "zod";

const depositInstanceIdSchema = z.guid(
  "Deposit instance id must be a valid UUID.",
);

export const hardDeleteDepositInstanceInputSchema = z.strictObject({
  depositInstanceId: depositInstanceIdSchema,
});

export type HardDeleteDepositInstanceInput = z.input<
  typeof hardDeleteDepositInstanceInputSchema
>;
export type HardDeleteDepositInstanceValues = z.output<
  typeof hardDeleteDepositInstanceInputSchema
>;
