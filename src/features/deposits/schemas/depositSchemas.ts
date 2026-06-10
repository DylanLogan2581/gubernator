import { z } from "zod";

import { depositInputLimits } from "@/lib/inputLimits";

const depositTypeIdSchema = z.guid("Select a deposit type.");
const worldIdSchema = z.guid("Select a world.");
const jobIdSchema = z.guid("Select a job.");

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
  resourceId: z.guid("Select a resource."),
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

export const softDeleteDepositTypeInputSchema = z.strictObject({
  depositTypeId: depositTypeIdSchema,
  worldId: worldIdSchema,
});

export const restoreDepositTypeInputSchema = z.strictObject({
  depositTypeId: depositTypeIdSchema,
  worldId: worldIdSchema,
});

export const hardDeleteDepositTypeInputSchema = z.strictObject({
  depositTypeId: depositTypeIdSchema,
  worldId: worldIdSchema,
});

export type CreateDepositTypeInput = z.input<
  typeof createDepositTypeInputSchema
>;
export type CreateDepositTypeValues = z.output<
  typeof createDepositTypeInputSchema
>;
export type HardDeleteDepositTypeInput = z.input<
  typeof hardDeleteDepositTypeInputSchema
>;
export type HardDeleteDepositTypeValues = z.output<
  typeof hardDeleteDepositTypeInputSchema
>;
export type RestoreDepositTypeInput = z.input<
  typeof restoreDepositTypeInputSchema
>;
export type RestoreDepositTypeValues = z.output<
  typeof restoreDepositTypeInputSchema
>;
export type SoftDeleteDepositTypeInput = z.input<
  typeof softDeleteDepositTypeInputSchema
>;
export type SoftDeleteDepositTypeValues = z.output<
  typeof softDeleteDepositTypeInputSchema
>;
export type UpdateDepositTypeInput = z.input<
  typeof updateDepositTypeInputSchema
>;
export type UpdateDepositTypeValues = z.output<
  typeof updateDepositTypeInputSchema
>;
export type WorkerInputEntryInput = z.input<typeof workerInputEntrySchema>;
export type WorkerInputEntryValues = z.output<typeof workerInputEntrySchema>;
