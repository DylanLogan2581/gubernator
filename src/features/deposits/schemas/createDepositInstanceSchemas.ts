import { z } from "zod";

import { depositInputLimits } from "@/lib/inputLimits";

const settlementIdSchema = z.guid("Settlement id must be a valid UUID.");
const depositTypeIdSchema = z.guid("Deposit type id must be a valid UUID.");

const depositInstanceNameSchema = z
  .string()
  .max(
    depositInputLimits.depositInstanceNameMax,
    "Deposit instance name is too long.",
  )
  .refine(
    (v): boolean => v.trim().length > 0,
    "Deposit instance name is required.",
  );

export const depositInstanceResourceEntrySchema = z.strictObject({
  initialQuantity: z.number().positive("Initial quantity must be positive."),
  resourceId: z.guid("Resource id must be a valid UUID."),
});

const resourcesArraySchema = z
  .array(depositInstanceResourceEntrySchema)
  .min(1, "At least one resource is required.");

export const createDepositInstanceInputSchema = z
  .strictObject({
    depositTypeId: depositTypeIdSchema,
    maxWorkers: z.int().min(1, "Max workers must be at least 1.").optional(),
    name: depositInstanceNameSchema,
    resources: resourcesArraySchema,
    settlementId: settlementIdSchema,
  })
  .superRefine((value, ctx): void => {
    const ids = value.resources.map((r) => r.resourceId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate resources are not allowed.",
        path: ["resources"],
      });
    }
  });

export type CreateDepositInstanceInput = z.input<
  typeof createDepositInstanceInputSchema
>;
export type CreateDepositInstanceValues = z.output<
  typeof createDepositInstanceInputSchema
>;
export type DepositInstanceResourceEntryInput = z.input<
  typeof depositInstanceResourceEntrySchema
>;
export type DepositInstanceResourceEntryValues = z.output<
  typeof depositInstanceResourceEntrySchema
>;
