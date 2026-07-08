import { z } from "zod";

import { tierCostEntrySchema } from "@/features/buildings";
import { unitTypeInputLimits } from "@/lib/inputLimits";

const unitTypeIdSchema = z.guid("Select a unit type.");
const worldIdSchema = z.guid("Select a world.");

const unitTypeNameSchema = z
  .string()
  .max(unitTypeInputLimits.nameMax, "Unit type name is too long.")
  .refine(
    (value): boolean => value.trim().length > 0,
    "Unit type name is required.",
  );

const unitTypeDescriptionSchema = z
  .string()
  .max(unitTypeInputLimits.descriptionMax, "Description is too long.")
  .transform((value): string | null => {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const optionalUnitTypeDescriptionSchema = z
  .union([unitTypeDescriptionSchema, z.null()])
  .optional();

const soldiersPerUnitSchema = z
  .int()
  .min(1, "Soldiers per unit must be at least 1.");

const desertionRateSchema = z
  .number()
  .min(0, "Desertion rate must be at least 0.")
  .max(1, "Desertion rate must be at most 1.");

const requiredEducationLevelIdSchema = z
  .guid("Select an education level.")
  .nullish();

const requiredBuildingBlueprintIdSchema = z
  .guid("Select a building blueprint.")
  .nullish();

const requiredBuildingTierNumberSchema = z
  .int()
  .min(1, "Tier number must be at least 1.")
  .nullish();

const costArraySchema = z.array(tierCostEntrySchema);

// Both the required building blueprint and tier number must be set together
// (recruit only where that building is active at >= that tier), or both left
// empty (recruit anywhere) -- mirrors the DB's paired CHECK constraint.
function checkBuildingRequirementPairing(
  value: {
    readonly requiredBuildingBlueprintId?: string | null;
    readonly requiredBuildingTierNumber?: number | null;
  },
  ctx: z.RefinementCtx,
): void {
  const hasBlueprint = value.requiredBuildingBlueprintId !== undefined;
  const hasTier = value.requiredBuildingTierNumber !== undefined;

  if (hasBlueprint !== hasTier) {
    ctx.addIssue({
      code: "custom",
      message:
        "Required building blueprint and tier must be provided together.",
      path: ["requiredBuildingBlueprintId"],
    });
    return;
  }

  if (hasBlueprint && hasTier) {
    const blueprintIsNull = value.requiredBuildingBlueprintId === null;
    const tierIsNull = value.requiredBuildingTierNumber === null;
    if (blueprintIsNull !== tierIsNull) {
      ctx.addIssue({
        code: "custom",
        message:
          "Required building blueprint and tier must both be set or both be empty.",
        path: ["requiredBuildingBlueprintId"],
      });
    }
  }
}

export const createUnitTypeInputSchema = z
  .strictObject({
    description: optionalUnitTypeDescriptionSchema,
    desertionRate: desertionRateSchema,
    name: unitTypeNameSchema,
    recruitmentCostsJson: costArraySchema.optional(),
    requiredBuildingBlueprintId: requiredBuildingBlueprintIdSchema,
    requiredBuildingTierNumber: requiredBuildingTierNumberSchema,
    requiredEducationLevelId: requiredEducationLevelIdSchema,
    soldiersPerUnit: soldiersPerUnitSchema,
    upkeepCostsJson: costArraySchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine(checkBuildingRequirementPairing);

export const updateUnitTypeInputSchema = z
  .strictObject({
    description: optionalUnitTypeDescriptionSchema,
    desertionRate: desertionRateSchema.optional(),
    name: unitTypeNameSchema.optional(),
    recruitmentCostsJson: costArraySchema.optional(),
    requiredBuildingBlueprintId: requiredBuildingBlueprintIdSchema,
    requiredBuildingTierNumber: requiredBuildingTierNumberSchema,
    requiredEducationLevelId: requiredEducationLevelIdSchema,
    soldiersPerUnit: soldiersPerUnitSchema.optional(),
    unitTypeId: unitTypeIdSchema,
    upkeepCostsJson: costArraySchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.description === undefined &&
      value.soldiersPerUnit === undefined &&
      value.desertionRate === undefined &&
      value.requiredEducationLevelId === undefined &&
      value.requiredBuildingBlueprintId === undefined &&
      value.requiredBuildingTierNumber === undefined &&
      value.recruitmentCostsJson === undefined &&
      value.upkeepCostsJson === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["name"],
      });
      return;
    }
    checkBuildingRequirementPairing(value, ctx);
  });

export const deleteUnitTypeInputSchema = z.strictObject({
  unitTypeId: unitTypeIdSchema,
  worldId: worldIdSchema,
});

export type CreateUnitTypeInput = z.input<typeof createUnitTypeInputSchema>;
export type CreateUnitTypeValues = z.output<typeof createUnitTypeInputSchema>;
export type UpdateUnitTypeInput = z.input<typeof updateUnitTypeInputSchema>;
export type UpdateUnitTypeValues = z.output<typeof updateUnitTypeInputSchema>;
export type DeleteUnitTypeInput = z.input<typeof deleteUnitTypeInputSchema>;
export type DeleteUnitTypeValues = z.output<typeof deleteUnitTypeInputSchema>;
