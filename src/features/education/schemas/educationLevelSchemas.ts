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

export const createEducationLevelInputSchema = z.strictObject({
  description: optionalEducationLevelDescriptionSchema,
  name: educationLevelNameSchema,
  worldId: worldIdSchema,
});

export const updateEducationLevelInputSchema = z
  .strictObject({
    description: optionalEducationLevelDescriptionSchema,
    educationLevelId: educationLevelIdSchema,
    name: educationLevelNameSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (value.name === undefined && value.description === undefined) {
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
