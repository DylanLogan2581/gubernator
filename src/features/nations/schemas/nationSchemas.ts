import { z } from "zod";

import { textInputLimits } from "@/lib/inputLimits";

const nationIdSchema = z.guid("Select a nation.");
const worldIdSchema = z.guid("Select a world.");

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

export const createNationInputSchema = z.strictObject({
  description: optionalNationDescriptionSchema,
  isHidden: z.boolean().optional(),
  name: nationNameSchema,
  worldId: worldIdSchema,
});

export const updateNationDetailsInputSchema = z.strictObject({
  description: optionalNationDescriptionSchema,
  name: nationNameSchema,
  nationId: nationIdSchema,
  worldId: worldIdSchema,
});

export const setNationHiddenInputSchema = z.strictObject({
  isHidden: z.boolean(),
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
export type SetNationHiddenInput = z.input<typeof setNationHiddenInputSchema>;
export type SetNationHiddenValues = z.output<typeof setNationHiddenInputSchema>;
export type DeleteNationInput = z.input<typeof deleteNationInputSchema>;
export type DeleteNationValues = z.output<typeof deleteNationInputSchema>;
