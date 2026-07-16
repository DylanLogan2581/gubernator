import { z } from "zod";

import { resourceInputLimits } from "@/lib/inputLimits";

const resourceIdSchema = z.guid("Select a resource.");
const worldIdSchema = z.guid("Select a world.");

const resourceNameSchema = z
  .string()
  .max(resourceInputLimits.resourceNameMax, "Resource name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Resource name is required.",
  );

const resourceSlugSchema = z
  .string()
  .max(resourceInputLimits.resourceSlugMax, "Resource slug is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Resource slug is required.",
  );

const baseStockpileCapSchema = z
  .string()
  .regex(
    /^\d+(\.\d{1,4})?$/,
    "Base stockpile cap must be a non-negative decimal with up to four decimal places.",
  )
  .transform((value): number => parseFloat(value));

const resourceChangeModeSchema = z.enum(["percent", "flat"]);

const changeAmountSchema = z
  .string()
  .regex(
    /^-?\d+(\.\d{1,2})?$/,
    "Change amount must be a decimal with up to two decimal places.",
  )
  .transform((value): number => parseFloat(value));

const resourceIconSchema = z
  .string()
  .max(64, "Icon name is too long.")
  .optional()
  .nullable();

const resourceIconColorSchema = z
  .number()
  .int()
  .min(1, "Icon color must be between 1 and 8.")
  .max(8, "Icon color must be between 1 and 8.")
  .optional()
  .nullable();

const resourceCategoryIdInputSchema = z
  .guid("Select a resource category.")
  .optional()
  .nullable();

function checkPercentChangeAmountRange(
  value: {
    readonly changeAmount?: number;
    readonly changeMode?: "percent" | "flat";
  },
  ctx: z.RefinementCtx,
): void {
  const mode = value.changeMode ?? "percent";
  if (
    mode === "percent" &&
    value.changeAmount !== undefined &&
    value.changeAmount < -100
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Percent decay cannot exceed 100% per turn.",
      path: ["changeAmount"],
    });
  }
}

export const createResourceInputSchema = z
  .strictObject({
    baseStockpileCap: baseStockpileCapSchema.optional(),
    categoryId: resourceCategoryIdInputSchema,
    changeAmount: changeAmountSchema.optional(),
    changeMode: resourceChangeModeSchema.optional(),
    icon: resourceIconSchema,
    iconColor: resourceIconColorSchema,
    name: resourceNameSchema,
    slug: resourceSlugSchema,
    worldId: worldIdSchema,
  })
  .superRefine(checkPercentChangeAmountRange);

export const updateResourceInputSchema = z
  .strictObject({
    baseStockpileCap: baseStockpileCapSchema.optional(),
    categoryId: resourceCategoryIdInputSchema,
    changeAmount: changeAmountSchema.optional(),
    changeMode: resourceChangeModeSchema.optional(),
    icon: resourceIconSchema,
    iconColor: resourceIconColorSchema,
    name: resourceNameSchema.optional(),
    resourceId: resourceIdSchema,
    slug: resourceSlugSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.slug === undefined &&
      value.baseStockpileCap === undefined &&
      value.changeMode === undefined &&
      value.changeAmount === undefined &&
      value.icon === undefined &&
      value.iconColor === undefined &&
      value.categoryId === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "At least one of name, slug, baseStockpileCap, changeMode, changeAmount, icon, iconColor, or categoryId must be provided.",
        path: ["name"],
      });
    }
    checkPercentChangeAmountRange(value, ctx);
  });

export const softDeleteResourceInputSchema = z.strictObject({
  resourceId: resourceIdSchema,
  worldId: worldIdSchema,
});

export const restoreResourceInputSchema = z.strictObject({
  resourceId: resourceIdSchema,
  worldId: worldIdSchema,
});

export const hardDeleteResourceInputSchema = z.strictObject({
  resourceId: resourceIdSchema,
  worldId: worldIdSchema,
});

export const cleanupSummarySchema = z.object({
  building_tier_construction_costs_cleaned: z.number().int().nonnegative(),
  building_tier_effects_cleaned: z.number().int().nonnegative(),
  building_tier_upkeep_costs_cleaned: z.number().int().nonnegative(),
  deposit_types_worker_inputs_cleaned: z.number().int().nonnegative(),
  job_definitions_inputs_cleaned: z.number().int().nonnegative(),
  job_definitions_outputs_cleaned: z.number().int().nonnegative(),
  managed_population_culling_outputs_cleaned: z.number().int().nonnegative(),
  managed_population_maintenance_cleaned: z.number().int().nonnegative(),
});

export type CreateResourceInput = z.input<typeof createResourceInputSchema>;
export type CreateResourceValues = z.output<typeof createResourceInputSchema>;
export type UpdateResourceInput = z.input<typeof updateResourceInputSchema>;
export type UpdateResourceValues = z.output<typeof updateResourceInputSchema>;
export type SoftDeleteResourceInput = z.input<
  typeof softDeleteResourceInputSchema
>;
export type SoftDeleteResourceValues = z.output<
  typeof softDeleteResourceInputSchema
>;
export type RestoreResourceInput = z.input<typeof restoreResourceInputSchema>;
export type RestoreResourceValues = z.output<typeof restoreResourceInputSchema>;
export type HardDeleteResourceInput = z.input<
  typeof hardDeleteResourceInputSchema
>;
export type HardDeleteResourceValues = z.output<
  typeof hardDeleteResourceInputSchema
>;
