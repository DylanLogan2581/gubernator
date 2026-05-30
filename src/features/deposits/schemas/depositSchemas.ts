import { z } from "zod";

import { depositInputLimits } from "@/lib/inputLimits";

const depositTypeIdSchema = z.guid("Deposit type id must be a valid UUID.");
const worldIdSchema = z.guid("World id must be a valid UUID.");
const jobIdSchema = z.guid("Job id must be a valid UUID.");

const depositTypeNameSchema = z
  .string()
  .max(depositInputLimits.depositTypeNameMax, "Deposit type name is too long.")
  .refine(
    (v): boolean => v.trim().length > 0,
    "Deposit type name is required.",
  );

const depositTypeSlugSchema = z
  .string()
  .max(depositInputLimits.depositTypeSlugMax, "Deposit type slug is too long.")
  .refine(
    (v): boolean => v.trim().length > 0,
    "Deposit type slug is required.",
  );

const outputUnitsPerWorkerSchema = z
  .int()
  .min(1, "Output units per worker must be at least 1.");

export const workerInputEntrySchema = z.strictObject({
  amountPerWorker: z.number().min(0, "Amount per worker must be non-negative."),
  resourceId: z.guid("Resource id must be a valid UUID."),
});

const workerInputArraySchema = z.array(workerInputEntrySchema);

export const createDepositTypeInputSchema = z.strictObject({
  jobId: jobIdSchema,
  name: depositTypeNameSchema,
  outputUnitsPerWorker: outputUnitsPerWorkerSchema,
  slug: depositTypeSlugSchema,
  workerInputsJson: workerInputArraySchema.optional(),
  worldId: worldIdSchema,
});

export const updateDepositTypeInputSchema = z
  .strictObject({
    depositTypeId: depositTypeIdSchema,
    jobId: jobIdSchema.optional(),
    name: depositTypeNameSchema.optional(),
    outputUnitsPerWorker: outputUnitsPerWorkerSchema.optional(),
    slug: depositTypeSlugSchema.optional(),
    workerInputsJson: workerInputArraySchema.optional(),
    worldId: worldIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (
      value.name === undefined &&
      value.slug === undefined &&
      value.jobId === undefined &&
      value.outputUnitsPerWorker === undefined &&
      value.workerInputsJson === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field must be provided.",
        path: ["name"],
      });
    }
  });

export const setDepositTypeActiveInputSchema = z.strictObject({
  depositTypeId: depositTypeIdSchema,
  isActive: z.boolean(),
  worldId: worldIdSchema,
});

export type CreateDepositTypeInput = z.input<
  typeof createDepositTypeInputSchema
>;
export type CreateDepositTypeValues = z.output<
  typeof createDepositTypeInputSchema
>;
export type UpdateDepositTypeInput = z.input<
  typeof updateDepositTypeInputSchema
>;
export type UpdateDepositTypeValues = z.output<
  typeof updateDepositTypeInputSchema
>;
export type SetDepositTypeActiveInput = z.input<
  typeof setDepositTypeActiveInputSchema
>;
export type SetDepositTypeActiveValues = z.output<
  typeof setDepositTypeActiveInputSchema
>;
export type WorkerInputEntryInput = z.input<typeof workerInputEntrySchema>;
export type WorkerInputEntryValues = z.output<typeof workerInputEntrySchema>;
