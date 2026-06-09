import { z } from "zod";

import { resourceInputLimits } from "@/lib/inputLimits";

const resourceIdSchema = z.guid("Resource id must be a valid UUID.");
const worldIdSchema = z.guid("World id must be a valid UUID.");

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

export const createResourceInputSchema = z.strictObject({
  baseStockpileCap: baseStockpileCapSchema.optional(),
  name: resourceNameSchema,
  slug: resourceSlugSchema,
  worldId: worldIdSchema,
});

const decayRateSchema = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Decay rate must be a non-negative decimal with up to two decimal places.",
  )
  .transform((value): number => parseFloat(value))
  .pipe(
    z
      .number()
      .min(0, "Decay rate must be at least 0.")
      .max(100, "Decay rate cannot exceed 100."),
  );

export const updateResourceInputSchema = z
  .strictObject({
    baseStockpileCap: baseStockpileCapSchema.optional(),
    decayRate: decayRateSchema.optional(),
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
      value.decayRate === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "At least one of name, slug, baseStockpileCap, or decayRate must be provided.",
        path: ["name"],
      });
    }
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
