import { z } from "zod";

import { managedPopulationInputLimits } from "@/lib/inputLimits";

const managedPopulationTypeIdSchema = z.guid(
  "Managed population type id must be a valid UUID.",
);
const worldIdSchema = z.guid("World id must be a valid UUID.");
const jobIdSchema = z.guid("Job id must be a valid UUID.");

const populationTypeNameSchema = z
  .string()
  .max(
    managedPopulationInputLimits.populationTypeNameMax,
    "Population type name is too long.",
  )
  .refine(
    (v): boolean => v.trim().length > 0,
    "Population type name is required.",
  );

const populationTypeSlugSchema = z
  .string()
  .max(
    managedPopulationInputLimits.populationTypeSlugMax,
    "Population type slug is too long.",
  )
  .refine(
    (v): boolean => v.trim().length > 0,
    "Population type slug is required.",
  );

const husbandryWorkersPerNAnimalsSchema = z
  .int()
  .min(1, "Husbandry workers per N animals must be at least 1.");

const growthRateSchema = z.number().min(0, "Growth rate must be non-negative.");

export const populationResourceEntrySchema = z.strictObject({
  amountPerNAnimals: z
    .number()
    .min(0, "Amount per N animals must be non-negative."),
  resourceId: z.guid("Resource id must be a valid UUID."),
});

const populationResourceArraySchema = z.array(populationResourceEntrySchema);

export const createManagedPopulationTypeInputSchema = z
  .strictObject({
    cullingJobId: jobIdSchema,
    cullingOutputsJson: populationResourceArraySchema.optional(),
    growthRate: growthRateSchema,
    husbandryJobId: jobIdSchema,
    husbandryWorkersPerNAnimals: husbandryWorkersPerNAnimalsSchema,
    maintenanceRulesJson: populationResourceArraySchema.optional(),
    name: populationTypeNameSchema,
    slug: populationTypeSlugSchema,
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (value.husbandryJobId === value.cullingJobId) {
      ctx.addIssue({
        code: "custom",
        message: "Husbandry job and culling job must be different.",
        path: ["cullingJobId"],
      });
    }
  });

export const updateManagedPopulationTypeInputSchema = z
  .strictObject({
    cullingJobId: jobIdSchema.optional(),
    cullingOutputsJson: populationResourceArraySchema.optional(),
    growthRate: growthRateSchema.optional(),
    husbandryJobId: jobIdSchema.optional(),
    husbandryWorkersPerNAnimals: husbandryWorkersPerNAnimalsSchema.optional(),
    maintenanceRulesJson: populationResourceArraySchema.optional(),
    managedPopulationTypeId: managedPopulationTypeIdSchema,
    name: populationTypeNameSchema.optional(),
    slug: populationTypeSlugSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.slug === undefined &&
      value.husbandryJobId === undefined &&
      value.cullingJobId === undefined &&
      value.husbandryWorkersPerNAnimals === undefined &&
      value.growthRate === undefined &&
      value.maintenanceRulesJson === undefined &&
      value.cullingOutputsJson === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["name"],
      });
    }

    if (
      value.husbandryJobId !== undefined &&
      value.cullingJobId !== undefined &&
      value.husbandryJobId === value.cullingJobId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Husbandry job and culling job must be different.",
        path: ["cullingJobId"],
      });
    }
  });

export const setManagedPopulationTypeActiveInputSchema = z.strictObject({
  isActive: z.boolean(),
  managedPopulationTypeId: managedPopulationTypeIdSchema,
  worldId: worldIdSchema,
});

export type CreateManagedPopulationTypeInput = z.input<
  typeof createManagedPopulationTypeInputSchema
>;
export type CreateManagedPopulationTypeValues = z.output<
  typeof createManagedPopulationTypeInputSchema
>;
export type UpdateManagedPopulationTypeInput = z.input<
  typeof updateManagedPopulationTypeInputSchema
>;
export type UpdateManagedPopulationTypeValues = z.output<
  typeof updateManagedPopulationTypeInputSchema
>;
export type SetManagedPopulationTypeActiveInput = z.input<
  typeof setManagedPopulationTypeActiveInputSchema
>;
export type SetManagedPopulationTypeActiveValues = z.output<
  typeof setManagedPopulationTypeActiveInputSchema
>;
export type PopulationResourceEntryInput = z.input<
  typeof populationResourceEntrySchema
>;
export type PopulationResourceEntryValues = z.output<
  typeof populationResourceEntrySchema
>;
