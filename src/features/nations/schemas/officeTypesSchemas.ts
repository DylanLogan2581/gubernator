import { z } from "zod";

import { officeTypeInputLimits } from "@/lib/inputLimits";

const nationIdSchema = z.guid("Select a nation.");
const worldIdSchema = z.guid("Select a world.");
const nullableNationIdSchema = z.union([nationIdSchema, z.null()]);

const officeTypeNameSchema = z
  .string()
  .max(officeTypeInputLimits.nameMax, "Office name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Office name is required.",
  );

const nullableColorSchema = z.union([z.string(), z.null()]).optional();
const nullableIconSchema = z.union([z.string(), z.null()]).optional();
const nullableDescriptionSchema = z.union([z.string(), z.null()]).optional();
const nullableMaxHoldersSchema = z
  .union([z.int().positive("Max holders must be greater than zero."), z.null()])
  .optional();
const nullableDefaultTermTurnsSchema = z
  .union([
    z.int().positive("Default term must be greater than zero."),
    z.null(),
  ])
  .optional();

export const createOfficeTypeInputSchema = z.strictObject({
  color: nullableColorSchema,
  defaultTermTurns: nullableDefaultTermTurnsSchema,
  description: nullableDescriptionSchema,
  excludesFromLabor: z.boolean(),
  icon: nullableIconSchema,
  maxHolders: nullableMaxHoldersSchema,
  name: officeTypeNameSchema,
  nationId: nullableNationIdSchema,
  scope: z.enum(["nation", "settlement"]),
  worldId: worldIdSchema,
});

export const updateOfficeTypeInputSchema = z.strictObject({
  color: nullableColorSchema,
  defaultTermTurns: nullableDefaultTermTurnsSchema,
  description: nullableDescriptionSchema,
  excludesFromLabor: z.boolean().optional(),
  icon: nullableIconSchema,
  id: z.guid("Select an office type."),
  maxHolders: nullableMaxHoldersSchema,
  name: officeTypeNameSchema.optional(),
  nationId: nullableNationIdSchema,
  worldId: worldIdSchema,
});

export type CreateOfficeTypeInput = z.input<typeof createOfficeTypeInputSchema>;
export type CreateOfficeTypeValues = z.output<
  typeof createOfficeTypeInputSchema
>;
export type UpdateOfficeTypeInput = z.input<typeof updateOfficeTypeInputSchema>;
export type UpdateOfficeTypeValues = z.output<
  typeof updateOfficeTypeInputSchema
>;
