import { z } from "zod";

import { armyInputLimits } from "@/lib/inputLimits";

const armyIdSchema = z.guid("Select an army.");
const nationIdSchema = z.guid("Select a nation.");
const settlementIdSchema = z.guid("Select a settlement.");

export const armyNameSchema = z
  .string()
  .max(armyInputLimits.nameMax, "Name is too long.")
  .refine((value): boolean => value.trim().length > 0, "Name is required.");

export const armyFundingSourceSchema = z.enum(["nation", "host_settlement"]);

export const createArmyInputSchema = z.strictObject({
  fundingSource: armyFundingSourceSchema,
  name: armyNameSchema,
  nationId: nationIdSchema,
  stationedSettlementId: settlementIdSchema,
});

export const renameArmyInputSchema = z.strictObject({
  armyId: armyIdSchema,
  name: armyNameSchema,
});

export const deleteArmyInputSchema = z.strictObject({
  armyId: armyIdSchema,
});

export const moveArmyInputSchema = z.strictObject({
  armyId: armyIdSchema,
  settlementId: settlementIdSchema,
});

export type CreateArmyInput = z.input<typeof createArmyInputSchema>;
export type CreateArmyValues = z.output<typeof createArmyInputSchema>;
export type RenameArmyInput = z.input<typeof renameArmyInputSchema>;
export type RenameArmyValues = z.output<typeof renameArmyInputSchema>;
export type DeleteArmyInput = z.input<typeof deleteArmyInputSchema>;
export type DeleteArmyValues = z.output<typeof deleteArmyInputSchema>;
export type MoveArmyInput = z.input<typeof moveArmyInputSchema>;
export type MoveArmyValues = z.output<typeof moveArmyInputSchema>;
