import { z } from "zod";

const depositInstanceIdSchema = z.guid(
  "Deposit instance id must be a valid UUID.",
);
const settlementIdSchema = z.guid("Settlement id must be a valid UUID.");

export const setDepositInstanceMaxWorkersInputSchema = z.strictObject({
  depositInstanceId: depositInstanceIdSchema,
  maxWorkers: z.int().min(1, "Max workers must be at least 1.").nullable(),
  removalStrategy: z.enum(["npc_first", "random"]).nullable(),
  settlementId: settlementIdSchema,
});

export type SetDepositInstanceMaxWorkersInput = z.input<
  typeof setDepositInstanceMaxWorkersInputSchema
>;
export type SetDepositInstanceMaxWorkersValues = z.output<
  typeof setDepositInstanceMaxWorkersInputSchema
>;
