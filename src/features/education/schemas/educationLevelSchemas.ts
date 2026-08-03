import { z } from "zod";

import { educationLevelInputLimits } from "@/lib/inputLimits";

const educationLevelIdSchema = z.guid("Select an education level.");
const worldIdSchema = z.guid("Select a world.");

const educationLevelNameSchema = z
  .string()
  .max(educationLevelInputLimits.nameMax, "Education level name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Education level name is required.",
  );

const educationLevelDescriptionSchema = z
  .string()
  .max(
    educationLevelInputLimits.descriptionMax,
    "Education level description is too long.",
  )
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalEducationLevelDescriptionSchema = z
  .union([educationLevelDescriptionSchema, z.null()])
  .optional();

const educationLevelNaturalBornPercentSchema = z
  .number()
  .min(0, "Natural born % must be at least 0.")
  .max(100, "Natural born % must be at most 100.");

const educationLevelIconSchema = z
  .string()
  .max(64, "Icon name is too long.")
  .optional()
  .nullable();

const educationLevelIconColorSchema = z
  .number()
  .int()
  .min(1, "Icon color must be between 1 and 8.")
  .max(8, "Icon color must be between 1 and 8.")
  .optional()
  .nullable();

export const createEducationLevelInputSchema = z.strictObject({
  description: optionalEducationLevelDescriptionSchema,
  icon: educationLevelIconSchema,
  iconColor: educationLevelIconColorSchema,
  name: educationLevelNameSchema,
  naturalBornPercent: educationLevelNaturalBornPercentSchema.optional(),
  worldId: worldIdSchema,
});

export const updateEducationLevelInputSchema = z
  .strictObject({
    description: optionalEducationLevelDescriptionSchema,
    educationLevelId: educationLevelIdSchema,
    icon: educationLevelIconSchema,
    iconColor: educationLevelIconColorSchema,
    name: educationLevelNameSchema.optional(),
    naturalBornPercent: educationLevelNaturalBornPercentSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.description === undefined &&
      value.naturalBornPercent === undefined &&
      value.icon === undefined &&
      value.iconColor === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one of name or description must be provided.",
        path: ["name"],
      });
    }
  });

export const deleteEducationLevelInputSchema = z.strictObject({
  educationLevelId: educationLevelIdSchema,
  worldId: worldIdSchema,
});

export const reorderEducationLevelInputSchema = z.strictObject({
  direction: z.enum(["up", "down"]),
  educationLevelId: educationLevelIdSchema,
  worldId: worldIdSchema,
});

export type CreateEducationLevelInput = z.input<
  typeof createEducationLevelInputSchema
>;
export type CreateEducationLevelValues = z.output<
  typeof createEducationLevelInputSchema
>;
export type UpdateEducationLevelInput = z.input<
  typeof updateEducationLevelInputSchema
>;
export type UpdateEducationLevelValues = z.output<
  typeof updateEducationLevelInputSchema
>;
export type DeleteEducationLevelInput = z.input<
  typeof deleteEducationLevelInputSchema
>;
export type DeleteEducationLevelValues = z.output<
  typeof deleteEducationLevelInputSchema
>;
export type ReorderEducationLevelInput = z.input<
  typeof reorderEducationLevelInputSchema
>;
export type ReorderEducationLevelValues = z.output<
  typeof reorderEducationLevelInputSchema
>;
