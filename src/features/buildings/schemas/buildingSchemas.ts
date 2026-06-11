import { z } from "zod";

import { buildingInputLimits } from "@/lib/inputLimits";

const blueprintIdSchema = z.guid("Select a blueprint.");
const tierIdSchema = z.guid("Select a tier.");
const worldIdSchema = z.guid("Select a world.");
const resourceIdSchema = z.guid("Select a resource.");
const jobIdSchema = z.guid("Select a job.");

const blueprintNameSchema = z
  .string()
  .max(buildingInputLimits.blueprintNameMax, "Blueprint name is too long.")
  .refine((v): boolean => v.trim().length > 0, "Blueprint name is required.");

const blueprintSlugSchema = z
  .string()
  .max(buildingInputLimits.blueprintSlugMax, "Blueprint slug is too long.")
  .refine((v): boolean => v.trim().length > 0, "Blueprint slug is required.");

const blueprintDescriptionSchema = z
  .string()
  .max(buildingInputLimits.blueprintDescriptionMax, "Description is too long.")
  .optional();

const gracePeriodTurnsSchema = z
  .int()
  .min(0, "Grace period must be non-negative.")
  .optional();

const maxInstancesPerSettlementSchema = z
  .int()
  .min(1, "Max instances must be at least 1.")
  .optional();

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
  description: blueprintDescriptionSchema,
  gracePeriodTurns: gracePeriodTurnsSchema,
  maxInstancesPerSettlement: maxInstancesPerSettlementSchema,
  name: blueprintNameSchema,
  slug: blueprintSlugSchema,
  worldId: worldIdSchema,
});

export const updateBlueprintInputSchema = z
  .strictObject({
    blueprintId: blueprintIdSchema,
    description: blueprintDescriptionSchema,
    gracePeriodTurns: gracePeriodTurnsSchema,
    maxInstancesPerSettlement: maxInstancesPerSettlementSchema,
    name: blueprintNameSchema.optional(),
    slug: blueprintSlugSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.slug === undefined &&
      value.description === undefined &&
      value.gracePeriodTurns === undefined &&
      value.maxInstancesPerSettlement === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["name"],
      });
    }
  });

export const softDeleteBlueprintInputSchema = z.strictObject({
  blueprintId: blueprintIdSchema,
  worldId: worldIdSchema,
});

export const restoreBlueprintInputSchema = z.strictObject({
  blueprintId: blueprintIdSchema,
  worldId: worldIdSchema,
});

export const hardDeleteBlueprintInputSchema = z.strictObject({
  blueprintId: blueprintIdSchema,
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
export type CreateTierInput = z.input<typeof createTierInputSchema>;
export type CreateTierValues = z.output<typeof createTierInputSchema>;
export type DeleteTierInput = z.input<typeof deleteTierInputSchema>;
export type DeleteTierValues = z.output<typeof deleteTierInputSchema>;
export type HardDeleteBlueprintInput = z.input<
  typeof hardDeleteBlueprintInputSchema
>;
export type HardDeleteBlueprintValues = z.output<
  typeof hardDeleteBlueprintInputSchema
>;
export type RestoreBlueprintInput = z.input<typeof restoreBlueprintInputSchema>;
export type RestoreBlueprintValues = z.output<
  typeof restoreBlueprintInputSchema
>;
export type SoftDeleteBlueprintInput = z.input<
  typeof softDeleteBlueprintInputSchema
>;
export type SoftDeleteBlueprintValues = z.output<
  typeof softDeleteBlueprintInputSchema
>;
export type TierCostEntryInput = z.input<typeof tierCostEntrySchema>;
export type TierCostEntryValues = z.output<typeof tierCostEntrySchema>;
export type TierEffectInput = z.input<typeof tierEffectSchema>;
export type TierEffectValues = z.output<typeof tierEffectSchema>;
export type UpdateBlueprintInput = z.input<typeof updateBlueprintInputSchema>;
export type UpdateBlueprintValues = z.output<typeof updateBlueprintInputSchema>;
export type UpdateTierInput = z.input<typeof updateTierInputSchema>;
export type UpdateTierValues = z.output<typeof updateTierInputSchema>;
