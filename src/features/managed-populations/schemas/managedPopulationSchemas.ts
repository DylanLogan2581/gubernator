import { z } from "zod";

import { managedPopulationInputLimits } from "@/lib/inputLimits";

const managedPopulationTypeIdSchema = z.guid(
  "Managed population type id must be a valid UUID.",
);
const worldIdSchema = z.guid("Select a world.");
const jobIdSchema = z.guid("Select a job.");

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

const maxCullPerWorkerSchema = z
  .int()
  .min(0, "Max cull per worker must be non-negative.");

const growthRateSchema = z.number().min(0, "Growth rate must be non-negative.");

export const populationResourceEntrySchema = z.strictObject({
  amountPerNAnimals: z
    .number()
    .min(0, "Amount per N animals must be non-negative."),
  resourceId: z.guid("Select a resource."),
});

const populationResourceArraySchema = z.array(populationResourceEntrySchema);

export const managedPopulationHusbandryJobSchema = z.strictObject({
  jobId: jobIdSchema,
  workersPerNAnimals: husbandryWorkersPerNAnimalsSchema,
});

const managedPopulationHusbandryJobsArraySchema = z
  .array(managedPopulationHusbandryJobSchema)
  .min(1, "At least one husbandry job is required.")
  .refine(
    (jobs) => new Set(jobs.map((j) => j.jobId)).size === jobs.length,
    "Each job may only be linked once as a husbandry job per population type.",
  );

export const managedPopulationCullingJobSchema = z.strictObject({
  jobId: jobIdSchema,
  maxCullPerWorker: maxCullPerWorkerSchema,
});

const managedPopulationCullingJobsArraySchema = z
  .array(managedPopulationCullingJobSchema)
  .min(1, "At least one culling job is required.")
  .refine(
    (jobs) => new Set(jobs.map((j) => j.jobId)).size === jobs.length,
    "Each job may only be linked once as a culling job per population type.",
  );

const populationTypeIconSchema = z
  .string()
  .max(64, "Icon name is too long.")
  .optional()
  .nullable();

const populationTypeIconColorSchema = z
  .number()
  .int()
  .min(1, "Icon color must be between 1 and 8.")
  .max(8, "Icon color must be between 1 and 8.")
  .optional()
  .nullable();

export const createManagedPopulationTypeInputSchema = z.strictObject({
  cullingJobs: managedPopulationCullingJobsArraySchema,
  cullingOutputsJson: populationResourceArraySchema.optional(),
  growthRate: growthRateSchema,
  husbandryJobs: managedPopulationHusbandryJobsArraySchema,
  icon: populationTypeIconSchema,
  iconColor: populationTypeIconColorSchema,
  maintenanceRulesJson: populationResourceArraySchema.optional(),
  name: populationTypeNameSchema,
  regularOutputsJson: populationResourceArraySchema.optional(),
  slug: populationTypeSlugSchema,
  worldId: worldIdSchema,
});

export const updateManagedPopulationTypeInputSchema = z
  .strictObject({
    cullingJobs: managedPopulationCullingJobsArraySchema.optional(),
    cullingOutputsJson: populationResourceArraySchema.optional(),
    growthRate: growthRateSchema.optional(),
    husbandryJobs: managedPopulationHusbandryJobsArraySchema.optional(),
    icon: populationTypeIconSchema,
    iconColor: populationTypeIconColorSchema,
    maintenanceRulesJson: populationResourceArraySchema.optional(),
    managedPopulationTypeId: managedPopulationTypeIdSchema,
    name: populationTypeNameSchema.optional(),
    regularOutputsJson: populationResourceArraySchema.optional(),
    slug: populationTypeSlugSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.slug === undefined &&
      value.husbandryJobs === undefined &&
      value.cullingJobs === undefined &&
      value.growthRate === undefined &&
      value.maintenanceRulesJson === undefined &&
      value.cullingOutputsJson === undefined &&
      value.regularOutputsJson === undefined &&
      value.icon === undefined &&
      value.iconColor === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["name"],
      });
    }
  });

export const softDeleteManagedPopulationTypeInputSchema = z.strictObject({
  managedPopulationTypeId: managedPopulationTypeIdSchema,
  worldId: worldIdSchema,
});

export const restoreManagedPopulationTypeInputSchema = z.strictObject({
  managedPopulationTypeId: managedPopulationTypeIdSchema,
  worldId: worldIdSchema,
});

export const hardDeleteManagedPopulationTypeInputSchema = z.strictObject({
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
export type SoftDeleteManagedPopulationTypeInput = z.input<
  typeof softDeleteManagedPopulationTypeInputSchema
>;
export type SoftDeleteManagedPopulationTypeValues = z.output<
  typeof softDeleteManagedPopulationTypeInputSchema
>;
export type RestoreManagedPopulationTypeInput = z.input<
  typeof restoreManagedPopulationTypeInputSchema
>;
export type RestoreManagedPopulationTypeValues = z.output<
  typeof restoreManagedPopulationTypeInputSchema
>;
export type HardDeleteManagedPopulationTypeInput = z.input<
  typeof hardDeleteManagedPopulationTypeInputSchema
>;
export type HardDeleteManagedPopulationTypeValues = z.output<
  typeof hardDeleteManagedPopulationTypeInputSchema
>;
export type PopulationResourceEntryInput = z.input<
  typeof populationResourceEntrySchema
>;
export type PopulationResourceEntryValues = z.output<
  typeof populationResourceEntrySchema
>;
export type ManagedPopulationHusbandryJobInput = z.input<
  typeof managedPopulationHusbandryJobSchema
>;
export type ManagedPopulationHusbandryJobValues = z.output<
  typeof managedPopulationHusbandryJobSchema
>;
export type ManagedPopulationCullingJobInput = z.input<
  typeof managedPopulationCullingJobSchema
>;
export type ManagedPopulationCullingJobValues = z.output<
  typeof managedPopulationCullingJobSchema
>;
