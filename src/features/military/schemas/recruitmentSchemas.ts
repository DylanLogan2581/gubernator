import { z } from "zod";

const unitIdSchema = z.guid("Select a unit.");
const settlementIdSchema = z.guid("Select a settlement.");

export const recruitSoldiersInputSchema = z.strictObject({
  citizenIds: z
    .array(z.guid("Select a citizen."))
    .min(1, "Select at least one citizen to recruit."),
  settlementId: settlementIdSchema,
  unitId: unitIdSchema,
});

export const dischargeSoldiersInputSchema = z.strictObject({
  soldierIds: z
    .array(z.guid("Select a soldier."))
    .min(1, "Select at least one soldier to discharge."),
});

export type RecruitSoldiersInput = z.input<typeof recruitSoldiersInputSchema>;
export type RecruitSoldiersValues = z.output<typeof recruitSoldiersInputSchema>;
export type DischargeSoldiersInput = z.input<
  typeof dischargeSoldiersInputSchema
>;
export type DischargeSoldiersValues = z.output<
  typeof dischargeSoldiersInputSchema
>;
