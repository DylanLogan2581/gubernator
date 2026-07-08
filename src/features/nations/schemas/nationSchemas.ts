import { z } from "zod";

import { textInputLimits } from "@/lib/inputLimits";

import {
  NATION_GOVERNMENT_TYPES,
  NATION_TRADE_POLICIES,
} from "../types/nationTypes";

const nationIdSchema = z.guid("Select a nation.");
const worldIdSchema = z.guid("Select a world.");

const nationGovernmentTypeSchema = z.enum(NATION_GOVERNMENT_TYPES);
const nationTradePolicySchema = z.enum(NATION_TRADE_POLICIES);

const nationNameSchema = z
  .string()
  .max(textInputLimits.nationNameMax, "Nation name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Nation name is required.",
  );

const nationDescriptionSchema = z
  .string()
  .max(textInputLimits.nationDescriptionMax, "Nation description is too long.")
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalNationDescriptionSchema = z
  .union([nationDescriptionSchema, z.null()])
  .optional();

const foundedTurnNumberSchema = z.union([z.int().min(0), z.null()]);
const optionalFoundedTurnNumberSchema = foundedTurnNumberSchema.optional();

export const createNationInputSchema = z.strictObject({
  description: optionalNationDescriptionSchema,
  foundedTurnNumber: optionalFoundedTurnNumberSchema,
  governmentType: nationGovernmentTypeSchema.optional(),
  name: nationNameSchema,
  worldId: worldIdSchema,
});

export const updateNationDetailsInputSchema = z.strictObject({
  description: optionalNationDescriptionSchema,
  name: nationNameSchema,
  nationId: nationIdSchema,
  worldId: worldIdSchema,
});

export const setNationGovernmentTypeInputSchema = z.strictObject({
  governmentType: nationGovernmentTypeSchema,
  nationId: nationIdSchema,
  worldId: worldIdSchema,
});

export const setNationTradePolicyInputSchema = z.strictObject({
  nationId: nationIdSchema,
  tradePolicy: nationTradePolicySchema,
});

export const setNationCultureReligionInputSchema = z.strictObject({
  nationId: nationIdSchema,
  primaryCultureId: z.union([z.guid(), z.null()]),
  stateReligionId: z.union([z.guid(), z.null()]),
});

export const setNationCapitalAndFoundedTurnInputSchema = z.strictObject({
  capitalSettlementId: z.union([z.guid(), z.null()]),
  foundedTurnNumber: foundedTurnNumberSchema,
  nationId: nationIdSchema,
  worldId: worldIdSchema,
});

export const deleteNationInputSchema = z.strictObject({
  nationId: nationIdSchema,
  worldId: worldIdSchema,
});

export type CreateNationInput = z.input<typeof createNationInputSchema>;
export type CreateNationValues = z.output<typeof createNationInputSchema>;
export type UpdateNationDetailsInput = z.input<
  typeof updateNationDetailsInputSchema
>;
export type UpdateNationDetailsValues = z.output<
  typeof updateNationDetailsInputSchema
>;
export type SetNationGovernmentTypeInput = z.input<
  typeof setNationGovernmentTypeInputSchema
>;
export type SetNationGovernmentTypeValues = z.output<
  typeof setNationGovernmentTypeInputSchema
>;
export type SetNationTradePolicyInput = z.input<
  typeof setNationTradePolicyInputSchema
>;
export type SetNationTradePolicyValues = z.output<
  typeof setNationTradePolicyInputSchema
>;
export type SetNationCultureReligionInput = z.input<
  typeof setNationCultureReligionInputSchema
>;
export type SetNationCultureReligionValues = z.output<
  typeof setNationCultureReligionInputSchema
>;
export type SetNationCapitalAndFoundedTurnInput = z.input<
  typeof setNationCapitalAndFoundedTurnInputSchema
>;
export type SetNationCapitalAndFoundedTurnValues = z.output<
  typeof setNationCapitalAndFoundedTurnInputSchema
>;
export type DeleteNationInput = z.input<typeof deleteNationInputSchema>;
export type DeleteNationValues = z.output<typeof deleteNationInputSchema>;
