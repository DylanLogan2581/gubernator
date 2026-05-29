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

// Discriminated union — each job type enforces its required type-specific field.
// standard/construction: base_capacity
// trader:               trader_capacity_per_worker
// deposit:              linked_deposit_type_id
// husbandry/culling:    linked_managed_population_type_id
export const createJobInputSchema = z.discriminatedUnion("jobType", [
  z.strictObject({
    baseCapacity: baseCapacitySchema,
    jobType: z.literal("standard"),
    ...commonCreateFields,
  }),
  z.strictObject({
    baseCapacity: baseCapacitySchema,
    jobType: z.literal("construction"),
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("trader"),
    traderCapacityPerWorker: traderCapacityPerWorkerSchema,
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("deposit"),
    linkedDepositTypeId: z.guid("Deposit type id must be a valid UUID."),
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("husbandry"),
    linkedManagedPopulationTypeId: z.guid(
      "Managed population type id must be a valid UUID.",
    ),
    ...commonCreateFields,
  }),
  z.strictObject({
    jobType: z.literal("culling"),
    linkedManagedPopulationTypeId: z.guid(
      "Managed population type id must be a valid UUID.",
    ),
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

export const setJobActiveInputSchema = z.strictObject({
  isActive: z.boolean(),
  jobId: jobIdSchema,
  worldId: worldIdSchema,
});

export type CreateJobInput = z.input<typeof createJobInputSchema>;
export type CreateJobValues = z.output<typeof createJobInputSchema>;
export type JobIoEntryInput = z.input<typeof jobIoEntrySchema>;
export type JobIoEntryValues = z.output<typeof jobIoEntrySchema>;
export type SetJobActiveInput = z.input<typeof setJobActiveInputSchema>;
export type SetJobActiveValues = z.output<typeof setJobActiveInputSchema>;
export type UpdateJobInput = z.input<typeof updateJobInputSchema>;
export type UpdateJobValues = z.output<typeof updateJobInputSchema>;
