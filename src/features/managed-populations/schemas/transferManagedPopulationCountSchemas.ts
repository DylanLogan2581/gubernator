import { z } from "zod";

const managedPopulationInstanceIdSchema = z.guid(
  "Managed population instance id must be a valid UUID.",
);

export const transferManagedPopulationCountInputSchema = z
  .strictObject({
    fromManagedPopulationInstanceId: managedPopulationInstanceIdSchema,
    toManagedPopulationInstanceId: managedPopulationInstanceIdSchema,
    count: z.number().positive("Count must be greater than 0."),
  })
  .superRefine((value, ctx): void => {
    if (
      value.fromManagedPopulationInstanceId ===
      value.toManagedPopulationInstanceId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Source and target must be different instances.",
        path: ["toManagedPopulationInstanceId"],
      });
    }
  });

export type TransferManagedPopulationCountInput = z.input<
  typeof transferManagedPopulationCountInputSchema
>;
export type TransferManagedPopulationCountValues = z.output<
  typeof transferManagedPopulationCountInputSchema
>;
