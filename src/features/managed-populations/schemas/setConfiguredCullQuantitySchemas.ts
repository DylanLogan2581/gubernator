import { z } from "zod";

const managedPopulationInstanceIdSchema = z.guid(
  "Managed population instance id must be a valid UUID.",
);

export const setConfiguredCullQuantityInputSchema = z.strictObject({
  managedPopulationInstanceId: managedPopulationInstanceIdSchema,
  quantity: z.number().min(0, "Quantity must be non-negative."),
});

export type SetConfiguredCullQuantityInput = z.input<
  typeof setConfiguredCullQuantityInputSchema
>;
export type SetConfiguredCullQuantityValues = z.output<
  typeof setConfiguredCullQuantityInputSchema
>;
