import { z } from "zod";

import { cultureReligionInputLimits } from "@/lib/inputLimits";

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const HEX_COLOR_MESSAGE = "Color must be a hex value like #6b7280.";
const DEFAULT_COLOR = "#6b7280";

const religionIdSchema = z.guid("Select a religion.");
const worldIdSchema = z.guid("Select a world.");

const religionNameSchema = z
  .string()
  .max(cultureReligionInputLimits.nameMax, "Religion name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Religion name is required.",
  );

const religionDescriptionSchema = z
  .string()
  .max(
    cultureReligionInputLimits.descriptionMax,
    "Religion description is too long.",
  )
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalReligionDescriptionSchema = z
  .union([religionDescriptionSchema, z.null()])
  .optional();

const createReligionColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, HEX_COLOR_MESSAGE)
  .default(DEFAULT_COLOR);

const updateReligionColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, HEX_COLOR_MESSAGE)
  .optional();

export const createReligionInputSchema = z.strictObject({
  color: createReligionColorSchema,
  description: optionalReligionDescriptionSchema,
  name: religionNameSchema,
  worldId: worldIdSchema,
});

export const updateReligionInputSchema = z
  .strictObject({
    color: updateReligionColorSchema,
    religionId: religionIdSchema,
    description: optionalReligionDescriptionSchema,
    name: religionNameSchema.optional(),
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

export const deleteReligionInputSchema = z.strictObject({
  religionId: religionIdSchema,
  worldId: worldIdSchema,
});

export type CreateReligionInput = z.input<typeof createReligionInputSchema>;
export type CreateReligionValues = z.output<typeof createReligionInputSchema>;
export type UpdateReligionInput = z.input<typeof updateReligionInputSchema>;
export type UpdateReligionValues = z.output<typeof updateReligionInputSchema>;
export type DeleteReligionInput = z.input<typeof deleteReligionInputSchema>;
export type DeleteReligionValues = z.output<typeof deleteReligionInputSchema>;
