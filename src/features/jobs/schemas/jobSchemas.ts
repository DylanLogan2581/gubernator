import { z } from "zod";

import { jobInputLimits } from "@/lib/inputLimits";

const jobIdSchema = z.guid("Job id must be a valid UUID.");
const worldIdSchema = z.guid("World id must be a valid UUID.");

const jobNameSchema = z
  .string()
  .max(jobInputLimits.jobNameMax, "Job name is too long.")
  .refine((v): boolean => v.trim().length > 0, "Job name is required.");

const jobSlugSchema = z
  .string()
  .max(jobInputLimits.jobSlugMax, "Job slug is too long.")
  .refine((v): boolean => v.trim().length > 0, "Job slug is required.");

const baseCapacitySchema = z
  .int()
  .min(0, "Base capacity must be a non-negative integer.");

const traderCapacityPerWorkerSchema = z
  .int()
  .min(0, "Trader capacity per worker must be a non-negative integer.");

export const jobIoEntrySchema = z.strictObject({
  amountPerWorker: z.number().min(0, "Amount per worker must be non-negative."),
  notes: z.string().optional(),
  resourceId: z.guid("Resource id must be a valid UUID."),
});

const jobIoArraySchema = z.array(jobIoEntrySchema);

const commonCreateFields = {
  inputsJson: jobIoArraySchema.optional(),
  name: jobNameSchema,
  outputsJson: jobIoArraySchema.optional(),
  slug: jobSlugSchema,
  worldId: worldIdSchema,
};

// Discriminated union — each job type permits its type-specific field.
// Type-specific fields are optional on creation; linkage is completed in the
// edit form (issue #13) once deposit-type and managed-population-type features
// are available.
export const createJobInputSchema = z.discriminatedUnion("jobType", [
  z.strictObject({
    baseCapacity: baseCapacitySchema.nullish(),
    jobType: z.literal("standard"),
    ...commonCreateFields,
  }),
  z.strictObject({
    baseCapacity: baseCapacitySchema.nullish(),
    jobType: z.literal("construction"),
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("trader"),
    traderCapacityPerWorker: traderCapacityPerWorkerSchema.nullish(),
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("deposit"),
    linkedDepositTypeId: z
      .guid("Deposit type id must be a valid UUID.")
      .nullish(),
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("husbandry"),
    linkedManagedPopulationTypeId: z
      .guid("Managed population type id must be a valid UUID.")
      .nullish(),
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("culling"),
    linkedManagedPopulationTypeId: z
      .guid("Managed population type id must be a valid UUID.")
      .nullish(),
    ...commonCreateFields,
  }),
]);

export const updateJobInputSchema = z
  .strictObject({
    baseCapacity: baseCapacitySchema.optional(),
    inputsJson: jobIoArraySchema.optional(),
    jobId: jobIdSchema,
    linkedDepositTypeId: z.guid().optional().nullable(),
    linkedManagedPopulationTypeId: z.guid().optional().nullable(),
    name: jobNameSchema.optional(),
    outputsJson: jobIoArraySchema.optional(),
    slug: jobSlugSchema.optional(),
    traderCapacityPerWorker: traderCapacityPerWorkerSchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.slug === undefined &&
      value.baseCapacity === undefined &&
      value.traderCapacityPerWorker === undefined &&
      value.linkedDepositTypeId === undefined &&
      value.linkedManagedPopulationTypeId === undefined &&
      value.inputsJson === undefined &&
      value.outputsJson === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["name"],
      });
    }
  });

export const softDeleteJobInputSchema = z.strictObject({
  jobId: jobIdSchema,
  worldId: worldIdSchema,
});

export const restoreJobInputSchema = z.strictObject({
  jobId: jobIdSchema,
  worldId: worldIdSchema,
});

export const hardDeleteJobInputSchema = z.strictObject({
  jobId: jobIdSchema,
  worldId: worldIdSchema,
});

export type CreateJobInput = z.input<typeof createJobInputSchema>;
export type CreateJobValues = z.output<typeof createJobInputSchema>;
export type HardDeleteJobInput = z.input<typeof hardDeleteJobInputSchema>;
export type HardDeleteJobValues = z.output<typeof hardDeleteJobInputSchema>;
export type JobIoEntryInput = z.input<typeof jobIoEntrySchema>;
export type JobIoEntryValues = z.output<typeof jobIoEntrySchema>;
export type RestoreJobInput = z.input<typeof restoreJobInputSchema>;
export type RestoreJobValues = z.output<typeof restoreJobInputSchema>;
export type SoftDeleteJobInput = z.input<typeof softDeleteJobInputSchema>;
export type SoftDeleteJobValues = z.output<typeof softDeleteJobInputSchema>;
export type UpdateJobInput = z.input<typeof updateJobInputSchema>;
export type UpdateJobValues = z.output<typeof updateJobInputSchema>;
