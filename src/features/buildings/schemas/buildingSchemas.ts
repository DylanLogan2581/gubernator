import { z } from "zod";

import { buildingInputLimits } from "@/lib/inputLimits";

const blueprintIdSchema = z.guid("Blueprint id must be a valid UUID.");
const tierIdSchema = z.guid("Tier id must be a valid UUID.");
const worldIdSchema = z.guid("World id must be a valid UUID.");
const resourceIdSchema = z.guid("Resource id must be a valid UUID.");
const jobIdSchema = z.guid("Job id must be a valid UUID.");

const blueprintNameSchema = z
  .string()
  .max(buildingInputLimits.blueprintNameMax, "Blueprint name is too long.")
  .refine((v): boolean => v.trim().length > 0, "Blueprint name is required.");

const blueprintSlugSchema = z
  .string()
  .max(buildingInputLimits.blueprintSlugMax, "Blueprint slug is too long.")
  .refine((v): boolean => v.trim().length > 0, "Blueprint slug is required.");

const tierNumberSchema = z.int().min(1, "Tier number must be at least 1.");

const workerTurnsRequiredSchema = z
  .int()
  .min(0, "Worker turns required must be a non-negative integer.");

const costAmountSchema = z.number().min(0, "Amount must be non-negative.");
const effectAmountSchema = z.number().min(0, "Amount must be non-negative.");

export const tierCostEntrySchema = z.strictObject({
  amount: costAmountSchema,
  resourceId: resourceIdSchema,
});

export const tierEffectSchema = z.discriminatedUnion("type", [
  z.strictObject({
    amount: effectAmountSchema,
    jobId: jobIdSchema,
    type: z.literal("job_capacity_increase"),
  }),
  z.strictObject({
    amount: effectAmountSchema,
    resourceId: resourceIdSchema,
    type: z.literal("passive_resource_production"),
  }),
  z.strictObject({
    amount: effectAmountSchema,
    resourceId: resourceIdSchema,
    type: z.literal("resource_storage_increase"),
  }),
  z.strictObject({
    amount: effectAmountSchema,
    type: z.literal("population_cap_increase"),
  }),
]);

const tierCostArraySchema = z.array(tierCostEntrySchema);
const tierEffectArraySchema = z.array(tierEffectSchema);

export const createBlueprintInputSchema = z.strictObject({
  name: blueprintNameSchema,
  slug: blueprintSlugSchema,
  worldId: worldIdSchema,
});

export const updateBlueprintInputSchema = z
  .strictObject({
    blueprintId: blueprintIdSchema,
    name: blueprintNameSchema.optional(),
    slug: blueprintSlugSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (value.name === undefined && value.slug === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["name"],
      });
    }
  });

export const setBlueprintActiveInputSchema = z.strictObject({
  blueprintId: blueprintIdSchema,
  isActive: z.boolean(),
  worldId: worldIdSchema,
});

export const createTierInputSchema = z.strictObject({
  blueprintId: blueprintIdSchema,
  constructionCostsJson: tierCostArraySchema.optional(),
  effectsJson: tierEffectArraySchema.optional(),
  tierNumber: tierNumberSchema,
  upkeepCostsJson: tierCostArraySchema.optional(),
  workerTurnsRequired: workerTurnsRequiredSchema.optional(),
});

export const updateTierInputSchema = z
  .strictObject({
    constructionCostsJson: tierCostArraySchema.optional(),
    effectsJson: tierEffectArraySchema.optional(),
    tierId: tierIdSchema,
    upkeepCostsJson: tierCostArraySchema.optional(),
    workerTurnsRequired: workerTurnsRequiredSchema.optional(),
  })
  .superRefine((value, ctx): void => {
    if (
      value.workerTurnsRequired === undefined &&
      value.constructionCostsJson === undefined &&
      value.upkeepCostsJson === undefined &&
      value.effectsJson === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["workerTurnsRequired"],
      });
    }
  });

export const deleteTierInputSchema = z.strictObject({
  tierId: tierIdSchema,
});

export type CreateBlueprintInput = z.input<typeof createBlueprintInputSchema>;
export type CreateBlueprintValues = z.output<typeof createBlueprintInputSchema>;
export type UpdateBlueprintInput = z.input<typeof updateBlueprintInputSchema>;
export type UpdateBlueprintValues = z.output<typeof updateBlueprintInputSchema>;
export type SetBlueprintActiveInput = z.input<
  typeof setBlueprintActiveInputSchema
>;
export type SetBlueprintActiveValues = z.output<
  typeof setBlueprintActiveInputSchema
>;
export type CreateTierInput = z.input<typeof createTierInputSchema>;
export type CreateTierValues = z.output<typeof createTierInputSchema>;
export type UpdateTierInput = z.input<typeof updateTierInputSchema>;
export type UpdateTierValues = z.output<typeof updateTierInputSchema>;
export type DeleteTierInput = z.input<typeof deleteTierInputSchema>;
export type DeleteTierValues = z.output<typeof deleteTierInputSchema>;
export type TierCostEntryInput = z.input<typeof tierCostEntrySchema>;
export type TierCostEntryValues = z.output<typeof tierCostEntrySchema>;
export type TierEffectInput = z.input<typeof tierEffectSchema>;
export type TierEffectValues = z.output<typeof tierEffectSchema>;
