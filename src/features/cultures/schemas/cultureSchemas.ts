import { z } from "zod";

import { cultureReligionInputLimits } from "@/lib/inputLimits";

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const HEX_COLOR_MESSAGE = "Color must be a hex value like #6b7280.";
const DEFAULT_COLOR = "#6b7280";

const cultureIdSchema = z.guid("Select a culture.");
const worldIdSchema = z.guid("Select a world.");

const cultureNameSchema = z
  .string()
  .max(cultureReligionInputLimits.nameMax, "Culture name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Culture name is required.",
  );

const cultureDescriptionSchema = z
  .string()
  .max(
    cultureReligionInputLimits.descriptionMax,
    "Culture description is too long.",
  )
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalCultureDescriptionSchema = z
  .union([cultureDescriptionSchema, z.null()])
  .optional();

const createCultureColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, HEX_COLOR_MESSAGE)
  .default(DEFAULT_COLOR);

const updateCultureColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, HEX_COLOR_MESSAGE)
  .optional();

export const createCultureInputSchema = z.strictObject({
  color: createCultureColorSchema,
  description: optionalCultureDescriptionSchema,
  name: cultureNameSchema,
  worldId: worldIdSchema,
});

export const updateCultureInputSchema = z
  .strictObject({
    color: updateCultureColorSchema,
    cultureId: cultureIdSchema,
    description: optionalCultureDescriptionSchema,
    name: cultureNameSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.description === undefined &&
      value.color === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "At least one of name, description, or color must be provided.",
        path: ["name"],
      });
    }
  });

export const deleteCultureInputSchema = z.strictObject({
  cultureId: cultureIdSchema,
  worldId: worldIdSchema,
});

export type CreateCultureInput = z.input<typeof createCultureInputSchema>;
export type CreateCultureValues = z.output<typeof createCultureInputSchema>;
export type UpdateCultureInput = z.input<typeof updateCultureInputSchema>;
export type UpdateCultureValues = z.output<typeof updateCultureInputSchema>;
export type DeleteCultureInput = z.input<typeof deleteCultureInputSchema>;
export type DeleteCultureValues = z.output<typeof deleteCultureInputSchema>;
