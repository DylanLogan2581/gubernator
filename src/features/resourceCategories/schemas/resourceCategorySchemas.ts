import { z } from "zod";

import { resourceCategoryInputLimits } from "@/lib/inputLimits";

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const HEX_COLOR_MESSAGE = "Color must be a hex value like #6b7280.";
const DEFAULT_COLOR = "#6b7280";

const resourceCategoryIdSchema = z.guid("Select a resource category.");
const worldIdSchema = z.guid("Select a world.");

const resourceCategoryNameSchema = z
  .string()
  .max(
    resourceCategoryInputLimits.nameMax,
    "Resource category name is too long.",
  )
  .refine(
    (value): boolean => value.trim().length > 0,
    "Resource category name is required.",
  );

const createResourceCategoryColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, HEX_COLOR_MESSAGE)
  .default(DEFAULT_COLOR);

const updateResourceCategoryColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, HEX_COLOR_MESSAGE)
  .optional();

export const createResourceCategoryInputSchema = z.strictObject({
  color: createResourceCategoryColorSchema,
  name: resourceCategoryNameSchema,
  worldId: worldIdSchema,
});

export const updateResourceCategoryInputSchema = z
  .strictObject({
    categoryId: resourceCategoryIdSchema,
    color: updateResourceCategoryColorSchema,
    name: resourceCategoryNameSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (value.name === undefined && value.color === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "At least one of name or color must be provided.",
        path: ["name"],
      });
    }
  });

export const deleteResourceCategoryInputSchema = z.strictObject({
  categoryId: resourceCategoryIdSchema,
  worldId: worldIdSchema,
});

export const reorderResourceCategoryInputSchema = z.strictObject({
  categoryId: resourceCategoryIdSchema,
  direction: z.enum(["up", "down"]),
  worldId: worldIdSchema,
});

export type CreateResourceCategoryInput = z.input<
  typeof createResourceCategoryInputSchema
>;
export type CreateResourceCategoryValues = z.output<
  typeof createResourceCategoryInputSchema
>;
export type UpdateResourceCategoryInput = z.input<
  typeof updateResourceCategoryInputSchema
>;
export type UpdateResourceCategoryValues = z.output<
  typeof updateResourceCategoryInputSchema
>;
export type DeleteResourceCategoryInput = z.input<
  typeof deleteResourceCategoryInputSchema
>;
export type DeleteResourceCategoryValues = z.output<
  typeof deleteResourceCategoryInputSchema
>;
export type ReorderResourceCategoryInput = z.input<
  typeof reorderResourceCategoryInputSchema
>;
export type ReorderResourceCategoryValues = z.output<
  typeof reorderResourceCategoryInputSchema
>;
