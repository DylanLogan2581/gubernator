import { z } from "zod";

import { managedPopulationInputLimits } from "@/lib/inputLimits";

const settlementIdSchema = z.guid("Settlement id must be a valid UUID.");
const managedPopulationTypeIdSchema = z.guid(
  "Managed population type id must be a valid UUID.",
);

const populationInstanceNameSchema = z
  .string()
  .max(
    managedPopulationInputLimits.populationInstanceNameMax,
    "Population instance name is too long.",
  )
  .refine(
    (v): boolean => v.trim().length > 0,
    "Population instance name is required.",
  );

export const createManagedPopulationInstanceInputSchema = z
  .strictObject({
    initialCount: z.number().positive("Initial count must be greater than 0."),
    initialCullQuantity: z
      .number()
      .min(0, "Initial cull quantity must be non-negative."),
    name: populationInstanceNameSchema,
    settlementId: settlementIdSchema,
    typeId: managedPopulationTypeIdSchema,
  })
  .superRefine((value, ctx): void => {
    if (value.initialCullQuantity > value.initialCount) {
      ctx.addIssue({
        code: "custom",
        message: "Initial cull quantity must not exceed initial count.",
        path: ["initialCullQuantity"],
      });
    }
  });

export type CreateManagedPopulationInstanceInput = z.input<
  typeof createManagedPopulationInstanceInputSchema
>;
export type CreateManagedPopulationInstanceValues = z.output<
  typeof createManagedPopulationInstanceInputSchema
>;
